import { supabase } from "./supabase.js";

// -------------------------------------------------------------
// Helpers para ler os campos da turma mesmo que o nome da coluna
// no banco seja um pouco diferente do esperado.
// -------------------------------------------------------------
function pegarCampoComChave(row, candidatos) {
  for (const chave of candidatos) {
    if (row[chave] !== undefined && row[chave] !== null && row[chave] !== "") {
      return { chave, valor: row[chave] };
    }
  }
  return null;
}

// Se não achou a coluna pelo nome, pega a próxima coluna numérica
// disponível na linha (ignorando as que já foram usadas em outros campos).
function pegarNumericoRestante(row, chavesJaUsadas) {
  const chavesIgnorarPorNome = ["id", "created_at", "updated_at", "criado_em", "atualizado_em"];
  const usadas = new Set(chavesJaUsadas.filter(Boolean));

  for (const [chave, valor] of Object.entries(row)) {
    if (usadas.has(chave)) continue;
    if (chavesIgnorarPorNome.includes(chave)) continue;
    if (valor === null || valor === undefined || valor === "" || typeof valor === "boolean") continue;

    const numero = Number(valor);
    if (!Number.isNaN(numero)) {
      return { chave, valor };
    }
  }
  return null;
}

function formatarPercentual(valor) {
  if (valor === null || valor === undefined) return "--";
  const numero = Number(valor);
  if (Number.isNaN(numero)) return "--";
  const percentual = numero <= 1 ? numero * 100 : numero;
  return `${percentual.toFixed(0)}%`;
}

function formatarMedia(valor) {
  if (valor === null || valor === undefined) return "--";
  const numero = Number(valor);
  if (Number.isNaN(numero)) return "--";
  // Se vier como proporção (0.95), converte para escala 0-10.
  const nota = numero <= 1 ? numero * 10 : numero;
  return nota.toFixed(1);
}

// Normaliza frequência e média para uma escala comum de 0-100,
// para dar pra somar/comparar as duas coisas de forma justa.
function normalizarParaCem(valor, ehNota) {
  if (valor === null || valor === undefined) return null;
  const numero = Number(valor);
  if (Number.isNaN(numero)) return null;

  if (numero <= 1) return numero * 100; // proporção tipo 0.95
  if (ehNota && numero <= 10) return numero * 10; // nota tipo 8.5 (escala 0-10)
  return numero; // já está em 0-100 (percentual)
}

function extrairTurma(row) {
  const nomeInfo = pegarCampoComChave(row, ["nome", "turma", "nome_turma", "turma_nome", "titulo"]);
  const segmentoInfo = pegarCampoComChave(row, ["segmento", "nivel", "etapa", "ensino"]);
  const turnoInfo = pegarCampoComChave(row, ["turno", "periodo"]);
  const frequenciaInfo = pegarCampoComChave(row, [
    "frequencia",
    "presenca",
    "frequencia_media",
    "taxa_presenca",
  ]);

  let mediaInfo = pegarCampoComChave(row, [
    "nota",
    "notas",
    "media",
    "media_geral",
    "nota_media",
    "media_notas",
    "media_final",
    "desempenho",
    "avaliacao",
    "pontuacao",
    "score",
  ]);

  // Evita usar a mesma coluna que já virou "frequência"
  if (mediaInfo && frequenciaInfo && mediaInfo.chave === frequenciaInfo.chave) {
    mediaInfo = null;
  }

  // Plano B: se não achou pelo nome, pega a próxima coluna numérica que sobrar
  if (!mediaInfo) {
    const chavesJaUsadas = [
      nomeInfo?.chave,
      segmentoInfo?.chave,
      turnoInfo?.chave,
      frequenciaInfo?.chave,
    ];
    mediaInfo = pegarNumericoRestante(row, chavesJaUsadas);
  }

  const frequenciaBruta = frequenciaInfo?.valor ?? null;
  const mediaBruta = mediaInfo?.valor ?? null;

  return {
    nome: nomeInfo?.valor ?? "Turma sem nome",
    segmento: segmentoInfo?.valor ?? "",
    turno: turnoInfo?.valor ?? "",
    frequenciaBruta,
    mediaBruta,
    frequencia: formatarPercentual(frequenciaBruta),
    media: formatarMedia(mediaBruta),
    frequenciaNormalizada: normalizarParaCem(frequenciaBruta, false),
    mediaNormalizada: normalizarParaCem(mediaBruta, true),
  };
}

// -------------------------------------------------------------
// Renderiza os cards das turmas
// -------------------------------------------------------------
function renderizarClasses(turmas) {
  const grid = document.getElementById("classesGrid");
  if (!grid) return;

  if (!turmas || turmas.length === 0) {
    grid.innerHTML = `<p style="color:#64748b;">Nenhuma turma encontrada.</p>`;
    return;
  }

  grid.innerHTML = turmas
    .map((row) => {
      const t = extrairTurma(row);
      return `
        <article class="class-card">
          <div class="class-card-top">
            <strong>${t.nome}</strong>
            <span class="class-meta">${t.turno}</span>
          </div>
          <div class="class-card-stats">
            <div class="class-card-stat">
              <span class="class-meta">Frequência</span>
              <span class="class-score">${t.frequencia}</span>
            </div>
            <div class="class-card-stat">
              <span class="class-meta">Média</span>
              <span class="class-score">${t.media}</span>
            </div>
          </div>
          <span class="class-meta">${t.segmento}</span>
        </article>
      `;
    })
    .join("");
}

// -------------------------------------------------------------
// Renderiza o Top 5 do ranking na sidebar
// Critério: combinação de frequência + média (as duas juntas),
// recalculado sempre a partir dos dados do banco.
// -------------------------------------------------------------
function renderizarRankingSidebar(turmas) {
  const lista = document.getElementById("sidebarRankingList");
  if (!lista) return;

  const comPontuacao = [...turmas]
    .map((row) => extrairTurma(row))
    .map((t) => {
      const valores = [t.frequenciaNormalizada, t.mediaNormalizada].filter(
        (v) => v !== null && v !== undefined
      );
      const pontuacao =
        valores.length > 0 ? valores.reduce((soma, v) => soma + v, 0) / valores.length : null;
      return { ...t, pontuacao };
    })
    .filter((t) => t.pontuacao !== null)
    .sort((a, b) => b.pontuacao - a.pontuacao)
    .slice(0, 5);

  const classesPorPosicao = ["ranking-sidebar-badge--ouro", "ranking-sidebar-badge--prata", "ranking-sidebar-badge--bronze"];

  lista.innerHTML = comPontuacao
    .map((t, index) => {
      const classeMedalha = classesPorPosicao[index] ?? "";
      return `
      <div class="ranking-sidebar-item">
        <div class="ranking-sidebar-badge ${classeMedalha}">${index + 1}º</div>
        <div class="ranking-sidebar-content">
          <span class="ranking-sidebar-turma">${t.nome}</span>
          <div class="ranking-sidebar-stats">
            <span class="ranking-sidebar-stat">Frequência: <strong>${t.frequencia}</strong></span>
            <span class="ranking-sidebar-stat">Média: <strong>${t.media}</strong></span>
          </div>
        </div>
      </div>
    `;
    })
    .join("");
}

// -------------------------------------------------------------
// Atualiza os cards de resumo no topo (com o que dá pra calcular
// a partir da tabela "turmas")
// -------------------------------------------------------------
function atualizarResumo(turmas) {
  const activeClassesEl = document.getElementById("activeClasses");
  if (activeClassesEl) {
    activeClassesEl.textContent = turmas.length;
  }

  const mediasValidas = turmas
    .map((row) => extrairTurma(row).mediaBruta)
    .filter((m) => m !== null)
    .map((m) => (Number(m) <= 1 ? Number(m) * 10 : Number(m)));

  const averageScoreEl = document.getElementById("averageScore");
  if (averageScoreEl && mediasValidas.length > 0) {
    const media =
      mediasValidas.reduce((soma, valor) => soma + valor, 0) / mediasValidas.length;
    averageScoreEl.textContent = media.toFixed(1);
  }

  // "Total alunos" e "Presentes hoje" dependem de uma tabela de alunos/presença
  // que ainda não temos aqui. Se você tiver essa tabela, me diga o nome dela
  // (e as colunas) que eu conecto os dois cards restantes.
}

// -------------------------------------------------------------
// Relógio da sidebar
// -------------------------------------------------------------
function atualizarRelogio() {
  const tempoElemento = document.getElementById("clockTime");
  const dataElemento = document.getElementById("clockDate");

  if (!tempoElemento || !dataElemento) return;

  const agora = new Date();
  tempoElemento.textContent = agora.toLocaleTimeString("pt-BR");

  const opcoesData = { day: "2-digit", month: "2-digit", year: "numeric" };
  dataElemento.textContent = agora.toLocaleDateString("pt-BR", opcoesData);
}

setInterval(atualizarRelogio, 1000);
atualizarRelogio();

// -------------------------------------------------------------
// Inicialização
// -------------------------------------------------------------
async function inicializarPainel() {
  console.log("🚀 Iniciando Painel Escolar...");
  console.log("🔄 Carregando dados do Supabase...");

  const { data, error } = await supabase.from("turmas").select("*");

  if (error) {
    console.error("❌ Erro na consulta:", error.message);
    return;
  }

  console.log("✅ Dados carregados com sucesso:", data);
  if (data && data.length > 0) {
    console.log("👉 Exemplo de uma linha (confira os nomes das colunas):", data[0]);
    console.log("👉 Campos identificados para a 1ª turma:", extrairTurma(data[0]));
  }

  renderizarClasses(data);
  renderizarRankingSidebar(data);
  atualizarResumo(data);
}

document.addEventListener("DOMContentLoaded", inicializarPainel);
import { useEffect, useMemo, useState } from "react";
import "../styles/index.css";
import { supabase } from "./supabase";

const IGNORED_FIELD_NAMES = [
  "id",
  "created_at",
  "updated_at",
  "criado_em",
  "atualizado_em",
];

function pegarCampoComChave(row, candidatos) {
  for (const chave of candidatos) {
    if (row[chave] !== undefined && row[chave] !== null && row[chave] !== "") {
      return { chave, valor: row[chave] };
    }
  }
  return null;
}

function pegarNumericoRestante(row, chavesJaUsadas) {
  const usadas = new Set(chavesJaUsadas.filter(Boolean));

  for (const [chave, valor] of Object.entries(row)) {
    if (usadas.has(chave)) continue;
    if (IGNORED_FIELD_NAMES.includes(chave)) continue;
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
  const nota = numero <= 1 ? numero * 10 : numero;
  return nota.toFixed(1);
}

function normalizarParaCem(valor, ehNota) {
  if (valor === null || valor === undefined) return null;
  const numero = Number(valor);
  if (Number.isNaN(numero)) return null;
  if (numero <= 1) return numero * 100;
  if (ehNota && numero <= 10) return numero * 10;
  return numero;
}

function pegarTotalAlunos(row, chavesJaUsadas) {
  const totalInfo = pegarCampoComChave(row, [
    "total_alunos",
    "alunos",
    "numero_alunos",
    "quantidade_alunos",
    "qtd_alunos",
    "matriculados",
    "total_estudantes",
    "estudantes",
  ]);

  if (totalInfo) {
    const numero = Number(totalInfo.valor);
    if (!Number.isNaN(numero)) {
      return numero;
    }
  }

  const restante = pegarNumericoRestante(row, chavesJaUsadas);
  if (restante) {
    return Number(restante.valor);
  }

  return null;
}

function extrairTurma(row) {
  const nomeInfo = pegarCampoComChave(row, [
    "nome",
    "turma",
    "nome_turma",
    "turma_nome",
    "titulo",
  ]);
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

  if (mediaInfo && frequenciaInfo && mediaInfo.chave === frequenciaInfo.chave) {
    mediaInfo = null;
  }

  const chavesJaUsadas = [
    nomeInfo?.chave,
    segmentoInfo?.chave,
    turnoInfo?.chave,
    frequenciaInfo?.chave,
    mediaInfo?.chave,
  ];

  if (!mediaInfo) {
    mediaInfo = pegarNumericoRestante(row, chavesJaUsadas);
  }

  const frequenciaBruta = frequenciaInfo?.valor ?? null;
  const mediaBruta = mediaInfo?.valor ?? null;
  const totalAlunos = pegarTotalAlunos(row, chavesJaUsadas);

  return {
    id: row.id ?? row.nome ?? row.turma ?? row.titulo ?? Math.random().toString(36).slice(2),
    nome: nomeInfo?.valor ?? "Turma sem nome",
    segmento: segmentoInfo?.valor ?? "",
    turno: turnoInfo?.valor ?? "",
    frequenciaBruta,
    mediaBruta,
    totalAlunos,
    frequencia: formatarPercentual(frequenciaBruta),
    media: formatarMedia(mediaBruta),
    frequenciaNormalizada: normalizarParaCem(frequenciaBruta, false),
    mediaNormalizada: normalizarParaCem(mediaBruta, true),
  };
}

function criarRanking(turmas) {
  const classesPorPosicao = [
    "ranking-sidebar-badge--ouro",
    "ranking-sidebar-badge--prata",
    "ranking-sidebar-badge--bronze",
  ];

  return turmas
    .map((row) => extrairTurma(row))
    .map((turma) => {
      const valores = [turma.frequenciaNormalizada, turma.mediaNormalizada].filter(
        (valor) => valor !== null && valor !== undefined
      );
      const pontuacao = valores.length > 0 ? valores.reduce((soma, valor) => soma + valor, 0) / valores.length : null;
      return { ...turma, pontuacao };
    })
    .filter((turma) => turma.pontuacao !== null)
    .sort((a, b) => b.pontuacao - a.pontuacao)
    .slice(0, 5)
    .map((turma, index) => ({
      ...turma,
      badgeClass: classesPorPosicao[index] ?? "",
      rank: index + 1,
    }));
}

function calcularResumo(turmas) {
  const extracoes = turmas.map((row) => extrairTurma(row));

  const mediasValidas = extracoes
    .map((turma) => turma.mediaBruta)
    .filter((media) => media !== null && media !== undefined)
    .map((media) => {
      const numero = Number(media);
      return numero <= 1 ? numero * 10 : numero;
    })
    .filter((valor) => !Number.isNaN(valor));

  const averageScore = mediasValidas.length
    ? mediasValidas.reduce((soma, valor) => soma + valor, 0) / mediasValidas.length
    : null;

  const frequenciasValidas = extracoes
    .map((turma) => turma.frequenciaBruta)
    .filter((frequencia) => frequencia !== null && frequencia !== undefined)
    .map((frequencia) => {
      const numero = Number(frequencia);
      return numero <= 1 ? numero * 100 : numero;
    })
    .filter((valor) => !Number.isNaN(valor));

  const averagePresence = frequenciasValidas.length
    ? frequenciasValidas.reduce((soma, valor) => soma + valor, 0) / frequenciasValidas.length
    : null;

  const totalCount = extracoes
    .map((turma) => Number(turma.totalAlunos) || 0)
    .reduce((soma, valor) => soma + valor, 0);

  return {
    totalCount,
    averagePresence: averagePresence !== null ? `${averagePresence.toFixed(0)}%` : "--",
    averageScore: averageScore !== null ? averageScore.toFixed(1) : "--",
    activeClasses: turmas.length,
  };
}

export default function App() {
  const [turmas, setTurmas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [agora, setAgora] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function carregarTurmas() {
      setLoading(true);
      const { data, error: fetchError } = await supabase.from("turmas").select("*");

      if (fetchError) {
        setError(fetchError.message);
        setTurmas([]);
      } else {
        setError(null);
        setTurmas(data ?? []);
      }
      setLoading(false);
    }

    carregarTurmas();
  }, []);

  const topoRanking = useMemo(() => criarRanking(turmas), [turmas]);
  const resumo = useMemo(() => calcularResumo(turmas), [turmas]);

  const tempo = agora.toLocaleTimeString("pt-BR");
  const data = agora.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div className="dashboard-page">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">🎓</div>
          <div>
            <p className="brand-label">Colégio Suplicy</p>
            <p className="brand-subtitle">Sistema Integrado</p>
          </div>
        </div>

        <div className="ranking-sidebar-card">
          <div className="ranking-sidebar-header">
            <p className="ranking-sidebar-eyebrow">Top 5</p>
            <h2>Ranking das turmas</h2>
          </div>
          <div className="ranking-sidebar-list">
            {topoRanking.map((turma) => (
              <div key={turma.id} className="ranking-sidebar-item">
                <div className={`ranking-sidebar-badge ${turma.badgeClass}`}>{turma.rank}º</div>
                <div className="ranking-sidebar-content">
                  <span className="ranking-sidebar-turma">{turma.nome}</span>
                  <div className="ranking-sidebar-stats">
                    <span className="ranking-sidebar-stat">
                      Frequência: <strong>{turma.frequencia}</strong>
                    </span>
                    <span className="ranking-sidebar-stat">
                      Média: <strong>{turma.media}</strong>
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {topoRanking.length === 0 && <p style={{ color: "#dbeafe" }}>Nenhuma turma disponível para ranking.</p>}
          </div>
        </div>

        <div className="sidebar-clock-card">
          <span className="sidebar-clock-label">Horário</span>
          <span className="sidebar-clock-time">{tempo}</span>
          <span className="sidebar-clock-date">{data}</span>
        </div>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div>
            <h1>Frequência e Desempenho</h1>
          </div>
        </header>

        {error && <p style={{ color: "#ef4444" }}>Erro ao carregar dados: {error}</p>}

        <section className="classes-grid-section">
          {loading ? (
            <p style={{ color: "#64748b" }}>Carregando turmas...</p>
          ) : turmas.length === 0 ? (
            <p style={{ color: "#64748b" }}>Nenhuma turma encontrada.</p>
          ) : (
            <div className="classes-grid">
              {turmas.map((row) => {
                const turma = extrairTurma(row);
                return (
                  <article key={turma.id} className="class-card">
                    <div className="class-card-top">
                      <strong>{turma.nome}</strong>
                      <span className="class-meta">{turma.turno}</span>
                    </div>
                    <div className="class-card-stats">
                      <div className="class-card-stat">
                        <span className="class-meta">Frequência</span>
                        <span className="class-score">{turma.frequencia}</span>
                      </div>
                      <div className="class-card-stat">
                        <span className="class-meta">Média</span>
                        <span className="class-score">{turma.media}</span>
                      </div>
                    </div>
                    <span className="class-meta">{turma.segmento}</span>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

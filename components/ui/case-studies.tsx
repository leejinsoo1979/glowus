"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Rocket, TrendingUp, Users, BarChart3, Zap, Target } from "lucide-react";
// Use standard img to avoid next/image domain config issues
// import Image from "next/image";

// Avoid SSR hydration issues by loading react-countup on the client.
const CountUp = dynamic(
  () => import("react-countup").then((mod) => mod.default),
  { ssr: false }
);

/** Hook: respects user's motion preferences */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !("matchMedia" in window)) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

/** Utility: parse a metric like "98%", "3.8x", "$1,200+", "1.5M", "€23.4k" */
function parseMetricValue(raw: string) {
  const value = (raw ?? "").toString().trim();
  const m = value.match(
    /^([^\d\-+]*?)\s*([\-+]?\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*([^\d\s]*)$/
  );
  if (!m) {
    return { prefix: "", end: 0, suffix: value, decimals: 0 };
  }
  const [, prefix, num, suffix] = m;
  const normalized = num.replace(/,/g, "");
  const end = parseFloat(normalized);
  const decimals = (normalized.split(".")[1]?.length ?? 0);
  return {
    prefix: prefix ?? "",
    end: isNaN(end) ? 0 : end,
    suffix: suffix ?? "",
    decimals,
  };
}

/** Small component: one animated metric */
function MetricStat({
  value,
  label,
  sub,
  duration = 1.6,
}: {
  value: string;
  label: string;
  sub?: string;
  duration?: number;
}) {
  const reduceMotion = usePrefersReducedMotion();
  const { prefix, end, suffix, decimals } = parseMetricValue(value);

  return (
    <div className="flex flex-col gap-2 text-left p-6">
      <p
        className="text-2xl font-medium text-zinc-800 dark:text-zinc-100 sm:text-4xl"
        aria-label={`${label} ${value}`}
      >
        <span className="text-accent">{prefix}</span>
        {reduceMotion ? (
          <span className="text-accent">
            {end.toLocaleString(undefined, {
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
            })}
          </span>
        ) : (
          <span className="text-accent">
            <CountUp
              end={end}
              decimals={decimals}
              duration={duration}
              separator=","
              enableScrollSpy
              scrollSpyOnce
            />
          </span>
        )}
        <span className="text-accent">{suffix}</span>
      </p>
      <p className="font-medium text-zinc-800 dark:text-zinc-100 text-left">
        {label}
      </p>
      {sub ? (
        <p className="text-zinc-600 dark:text-zinc-400 text-left text-sm">{sub}</p>
      ) : null}
    </div>
  );
}

interface CaseStudy {
  id: number;
  quote: string;
  name: string;
  role: string;
  company: string;
  image: string;
  icon: React.ElementType;
  metrics: { value: string; label: string; sub?: string }[];
}

interface CaseStudiesProps {
  title?: string;
  subtitle?: string;
  caseStudies?: CaseStudy[];
}

export default function CaseStudies({
  title = "GlowUS와 함께한 성공 사례",
  subtitle = "스타트업부터 성장기업까지—GlowUS가 어떻게 팀의 성장을 가속화했는지 확인하세요.",
  caseStudies,
}: CaseStudiesProps) {
  const defaultCaseStudies: CaseStudy[] = [
    {
      id: 1,
      quote:
        "GlowUS 덕분에 투자자 미팅 준비 시간이 80% 줄었어요. 실시간 KPI 대시보드로 항상 최신 데이터를 보여줄 수 있습니다.",
      name: "김민수",
      role: "CEO & Co-founder",
      company: "테크스타트 AI",
      image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=500&fit=crop",
      icon: Rocket,
      metrics: [
        { value: "80%", label: "준비 시간 단축", sub: "IR 미팅 준비" },
        { value: "3x", label: "투자 유치 성공률", sub: "시드 라운드 기준" },
      ],
    },
    {
      id: 2,
      quote:
        "팀원들의 업무 커밋을 한눈에 볼 수 있어서 병목 구간을 빠르게 파악하고 해결할 수 있었습니다. 생산성이 확실히 올랐어요.",
      name: "이서연",
      role: "COO",
      company: "핀테크랩",
      image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=500&fit=crop",
      icon: TrendingUp,
      metrics: [
        { value: "45%", label: "생산성 향상", sub: "팀 전체 기준" },
        { value: "60%", label: "병목 해결 속도", sub: "이전 대비" },
      ],
    },
    {
      id: 3,
      quote:
        "AI 인사이트 기능이 정말 유용해요. 주간 리포트가 자동 생성되니 경영진 보고가 훨씬 수월해졌습니다.",
      name: "박준혁",
      role: "CTO",
      company: "클라우드나인",
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=500&fit=crop",
      icon: BarChart3,
      metrics: [
        { value: "90%", label: "리포트 자동화", sub: "수동 작업 감소" },
        { value: "2x", label: "의사결정 속도", sub: "데이터 기반" },
      ],
    },
  ];

  const studies = caseStudies || defaultCaseStudies;

  return (
    <section
      className="py-24 bg-gray-50 dark:bg-zinc-950"
      aria-labelledby="case-studies-heading"
    >
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-16">
        {/* Header */}
        <div className="flex flex-col gap-4 text-center max-w-2xl mx-auto mb-16">
          <h2
            id="case-studies-heading"
            className="text-3xl font-bold md:text-4xl text-zinc-800 dark:text-zinc-100"
          >
            {title}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 text-lg">
            {subtitle}
          </p>
        </div>

        {/* Cases */}
        <div className="flex flex-col gap-16">
          {studies.map((study, idx) => {
            const reversed = idx % 2 === 1;
            const Icon = study.icon;
            return (
              <div
                key={study.id}
                className="grid gap-8 lg:grid-cols-3 xl:gap-16 items-center border-b border-gray-200 dark:border-zinc-800 pb-16 last:border-b-0"
              >
                {/* Left: Image + Quote */}
                <div
                  className={`flex flex-col sm:flex-row gap-8 lg:col-span-2 lg:border-r lg:pr-12 xl:pr-16 text-left border-gray-200 dark:border-zinc-800 ${
                    reversed
                      ? "lg:order-2 lg:border-r-0 lg:border-l lg:pl-12 xl:pl-16 lg:pr-0"
                      : ""
                  }`}
                >
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={study.image}
                      alt={`${study.name} portrait`}
                      width={240}
                      height={300}
                      className="aspect-[4/5] h-auto w-full max-w-[200px] rounded-2xl object-cover ring-1 ring-gray-200 dark:ring-zinc-700 hover:scale-105 transition-all duration-300"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="absolute -bottom-3 -right-3 w-12 h-12 bg-accent rounded-xl flex items-center justify-center">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <figure className="flex flex-col justify-between gap-6 text-left flex-1">
                    <blockquote className="text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed">
                      <span className="text-accent text-4xl leading-none">&ldquo;</span>
                      {study.quote}
                    </blockquote>
                    <figcaption className="flex flex-col gap-1 mt-4">
                      <span className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
                        {study.name}
                      </span>
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        {study.role} · {study.company}
                      </span>
                    </figcaption>
                  </figure>
                </div>

                {/* Right: Metrics */}
                <div
                  className={`grid grid-cols-1 gap-4 self-center text-left ${
                    reversed ? "lg:order-1" : ""
                  }`}
                >
                  {study.metrics.map((metric, i) => (
                    <MetricStat
                      key={`${study.id}-${i}`}
                      value={metric.value}
                      label={metric.label}
                      sub={metric.sub}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export { CaseStudies };

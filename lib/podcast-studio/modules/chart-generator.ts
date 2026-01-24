/**
 * Chart Generator Module
 * 차트/그래프 SVG 생성 (NotebookLM 스타일 슬라이드용)
 */

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'area' | 'donut'
  title?: string
  labels: string[]
  datasets: Array<{
    label?: string
    data: number[]
    color?: string
  }>
  width?: number
  height?: number
  showLegend?: boolean
  showValues?: boolean
}

export interface ChartResult {
  svg: string
  dataUrl: string
}

// 색상 팔레트
const CHART_COLORS = [
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#06B6D4', // cyan-500
  '#84CC16', // lime-500
]

/**
 * 차트 SVG 생성
 */
export function generateChart(config: ChartConfig): ChartResult {
  const width = config.width || 800
  const height = config.height || 400
  const padding = 60

  let svg = ''

  switch (config.type) {
    case 'bar':
      svg = generateBarChart(config, width, height, padding)
      break
    case 'line':
      svg = generateLineChart(config, width, height, padding)
      break
    case 'pie':
    case 'donut':
      svg = generatePieChart(config, width, height, config.type === 'donut')
      break
    case 'area':
      svg = generateAreaChart(config, width, height, padding)
      break
    default:
      svg = generateBarChart(config, width, height, padding)
  }

  // Base64 Data URL로 변환
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`

  return { svg, dataUrl }
}

/**
 * 바 차트 생성
 */
function generateBarChart(
  config: ChartConfig,
  width: number,
  height: number,
  padding: number
): string {
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2
  const labels = config.labels
  const data = config.datasets[0]?.data || []
  const maxValue = Math.max(...data, 1)
  const barWidth = (chartWidth / labels.length) * 0.7
  const barGap = (chartWidth / labels.length) * 0.3

  let bars = ''
  let labelTexts = ''
  let valueTexts = ''

  data.forEach((value, i) => {
    const barHeight = (value / maxValue) * chartHeight
    const x = padding + i * (barWidth + barGap) + barGap / 2
    const y = padding + chartHeight - barHeight
    const color = config.datasets[0]?.color || CHART_COLORS[i % CHART_COLORS.length]

    bars += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" rx="4" opacity="0.9"/>\n`

    // 라벨
    labelTexts += `<text x="${x + barWidth / 2}" y="${height - 15}" text-anchor="middle" font-size="12" fill="#666">${labels[i]}</text>\n`

    // 값
    if (config.showValues !== false) {
      valueTexts += `<text x="${x + barWidth / 2}" y="${y - 5}" text-anchor="middle" font-size="11" font-weight="bold" fill="#333">${formatNumber(value)}</text>\n`
    }
  })

  return wrapSvg(width, height, `
    ${generateGrid(chartWidth, chartHeight, padding, maxValue)}
    ${bars}
    ${labelTexts}
    ${valueTexts}
    ${config.title ? `<text x="${width / 2}" y="25" text-anchor="middle" font-size="16" font-weight="bold" fill="#333">${config.title}</text>` : ''}
  `)
}

/**
 * 라인 차트 생성
 */
function generateLineChart(
  config: ChartConfig,
  width: number,
  height: number,
  padding: number
): string {
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2
  const labels = config.labels
  const data = config.datasets[0]?.data || []
  const maxValue = Math.max(...data, 1)
  const stepX = chartWidth / (labels.length - 1 || 1)

  let pathD = ''
  let points = ''
  let labelTexts = ''

  data.forEach((value, i) => {
    const x = padding + i * stepX
    const y = padding + chartHeight - (value / maxValue) * chartHeight
    const color = config.datasets[0]?.color || CHART_COLORS[0]

    if (i === 0) {
      pathD = `M ${x} ${y}`
    } else {
      pathD += ` L ${x} ${y}`
    }

    points += `<circle cx="${x}" cy="${y}" r="5" fill="${color}"/>\n`

    if (config.showValues !== false) {
      points += `<text x="${x}" y="${y - 10}" text-anchor="middle" font-size="11" fill="#333">${formatNumber(value)}</text>\n`
    }

    labelTexts += `<text x="${x}" y="${height - 15}" text-anchor="middle" font-size="12" fill="#666">${labels[i]}</text>\n`
  })

  const lineColor = config.datasets[0]?.color || CHART_COLORS[0]

  return wrapSvg(width, height, `
    ${generateGrid(chartWidth, chartHeight, padding, maxValue)}
    <path d="${pathD}" fill="none" stroke="${lineColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    ${points}
    ${labelTexts}
    ${config.title ? `<text x="${width / 2}" y="25" text-anchor="middle" font-size="16" font-weight="bold" fill="#333">${config.title}</text>` : ''}
  `)
}

/**
 * 파이/도넛 차트 생성
 */
function generatePieChart(
  config: ChartConfig,
  width: number,
  height: number,
  isDonut: boolean = false
): string {
  const cx = width / 2
  const cy = height / 2 + 10
  const radius = Math.min(width, height) / 2 - 50
  const innerRadius = isDonut ? radius * 0.6 : 0
  const data = config.datasets[0]?.data || []
  const total = data.reduce((a, b) => a + b, 0) || 1

  let slices = ''
  let labels = ''
  let currentAngle = -90

  data.forEach((value, i) => {
    const percentage = value / total
    const angle = percentage * 360
    const color = CHART_COLORS[i % CHART_COLORS.length]

    // 파이 슬라이스
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    const largeArc = angle > 180 ? 1 : 0

    const startOuter = polarToCartesian(cx, cy, radius, endAngle)
    const endOuter = polarToCartesian(cx, cy, radius, startAngle)
    const startInner = polarToCartesian(cx, cy, innerRadius, endAngle)
    const endInner = polarToCartesian(cx, cy, innerRadius, startAngle)

    let d: string
    if (isDonut) {
      d = `M ${startOuter.x} ${startOuter.y} A ${radius} ${radius} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y} L ${endInner.x} ${endInner.y} A ${innerRadius} ${innerRadius} 0 ${largeArc} 1 ${startInner.x} ${startInner.y} Z`
    } else {
      d = `M ${cx} ${cy} L ${startOuter.x} ${startOuter.y} A ${radius} ${radius} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y} Z`
    }

    slices += `<path d="${d}" fill="${color}" opacity="0.9"/>\n`

    // 라벨
    const labelAngle = startAngle + angle / 2
    const labelRadius = radius + 25
    const labelPos = polarToCartesian(cx, cy, labelRadius, labelAngle)
    const label = config.labels[i] || ''
    const percentText = `${(percentage * 100).toFixed(1)}%`

    labels += `<text x="${labelPos.x}" y="${labelPos.y}" text-anchor="middle" font-size="11" fill="#333">${label}</text>\n`
    labels += `<text x="${labelPos.x}" y="${labelPos.y + 14}" text-anchor="middle" font-size="10" fill="#666">${percentText}</text>\n`

    currentAngle = endAngle
  })

  return wrapSvg(width, height, `
    ${slices}
    ${labels}
    ${config.title ? `<text x="${width / 2}" y="25" text-anchor="middle" font-size="16" font-weight="bold" fill="#333">${config.title}</text>` : ''}
  `)
}

/**
 * 영역 차트 생성
 */
function generateAreaChart(
  config: ChartConfig,
  width: number,
  height: number,
  padding: number
): string {
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2
  const labels = config.labels
  const data = config.datasets[0]?.data || []
  const maxValue = Math.max(...data, 1)
  const stepX = chartWidth / (labels.length - 1 || 1)

  let pathD = ''
  let areaD = `M ${padding} ${padding + chartHeight}`
  let labelTexts = ''

  data.forEach((value, i) => {
    const x = padding + i * stepX
    const y = padding + chartHeight - (value / maxValue) * chartHeight

    if (i === 0) {
      pathD = `M ${x} ${y}`
      areaD += ` L ${x} ${y}`
    } else {
      pathD += ` L ${x} ${y}`
      areaD += ` L ${x} ${y}`
    }

    labelTexts += `<text x="${x}" y="${height - 15}" text-anchor="middle" font-size="12" fill="#666">${labels[i]}</text>\n`
  })

  areaD += ` L ${padding + chartWidth} ${padding + chartHeight} Z`
  const color = config.datasets[0]?.color || CHART_COLORS[0]

  return wrapSvg(width, height, `
    ${generateGrid(chartWidth, chartHeight, padding, maxValue)}
    <path d="${areaD}" fill="${color}" opacity="0.3"/>
    <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2"/>
    ${labelTexts}
    ${config.title ? `<text x="${width / 2}" y="25" text-anchor="middle" font-size="16" font-weight="bold" fill="#333">${config.title}</text>` : ''}
  `)
}

// ============================================================================
// Helper Functions
// ============================================================================

function wrapSvg(width: number, height: number, content: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="white"/>
  ${content}
</svg>`
}

function generateGrid(
  chartWidth: number,
  chartHeight: number,
  padding: number,
  maxValue: number
): string {
  let grid = ''
  const gridLines = 5

  for (let i = 0; i <= gridLines; i++) {
    const y = padding + (chartHeight / gridLines) * i
    const value = maxValue - (maxValue / gridLines) * i

    grid += `<line x1="${padding}" y1="${y}" x2="${padding + chartWidth}" y2="${y}" stroke="#eee" stroke-width="1"/>\n`
    grid += `<text x="${padding - 10}" y="${y + 4}" text-anchor="end" font-size="10" fill="#999">${formatNumber(value)}</text>\n`
  }

  return grid
}

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const rad = (angle * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad)
  }
}

function formatNumber(value: number): string {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M'
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + 'K'
  }
  return value.toFixed(0)
}

export default generateChart

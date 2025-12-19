'use client'

import { useRef, useEffect, useMemo, useCallback, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { useThemeStore, accentColors } from '@/stores/themeStore'
import type { BrainNode, BrainEdge, NodeType } from '@/types/brain-map'

// ============================================
// Types
// ============================================

interface GraphRendererProps {
  nodes: BrainNode[]
  edges: BrainEdge[]
  selectedNodeId: string | null
  hoveredNodeId: string | null
  onNodeClick: (nodeId: string) => void
  onNodeHover: (nodeId: string | null) => void
  onNodeExpand?: (nodeId: string) => void
  onFpsUpdate?: (fps: number) => void
  isDark: boolean
  className?: string
}

interface NodeMeshData {
  id: string
  position: THREE.Vector3
  color: THREE.Color
  size: number
  type: NodeType
}

// ============================================
// Constants
// ============================================

// 단일 색상 기반 (rainbow 제거 - 사용자 테마 기준)
// 노드 타입별로 밝기/투명도만 조절
const NODE_TYPE_BRIGHTNESS: Record<NodeType, number> = {
  memory: 1.0,
  concept: 0.95,
  person: 0.9,
  doc: 0.85,
  task: 0.8,
  decision: 1.0,
  meeting: 0.75,
  tool: 0.7,
  skill: 0.65,
}

// ============================================
// Force Layout Worker (간단한 버전)
// ============================================

function forceLayout(
  nodes: BrainNode[],
  edges: BrainEdge[],
  iterations: number = 100
): Map<string, THREE.Vector3> {
  const positions = new Map<string, THREE.Vector3>()

  // 초기 위치 (랜덤)
  nodes.forEach(node => {
    const pos = new THREE.Vector3(
      (Math.random() - 0.5) * 200,
      (Math.random() - 0.5) * 200,
      (Math.random() - 0.5) * 200
    )
    // 기존 위치가 있으면 사용
    if (node.x !== undefined && node.y !== undefined && node.z !== undefined) {
      pos.set(node.x, node.y, node.z)
    }
    positions.set(node.id, pos)
  })

  const edgeMap = new Map<string, string[]>()
  edges.forEach(edge => {
    if (!edgeMap.has(edge.source)) edgeMap.set(edge.source, [])
    if (!edgeMap.has(edge.target)) edgeMap.set(edge.target, [])
    edgeMap.get(edge.source)!.push(edge.target)
    edgeMap.get(edge.target)!.push(edge.source)
  })

  // Force-directed 시뮬레이션 (간단한 버전)
  const repulsionStrength = 500
  const attractionStrength = 0.01
  const damping = 0.9

  const velocities = new Map<string, THREE.Vector3>()
  nodes.forEach(node => velocities.set(node.id, new THREE.Vector3()))

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion (모든 노드 간)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const posA = positions.get(nodes[i].id)!
        const posB = positions.get(nodes[j].id)!
        const diff = new THREE.Vector3().subVectors(posA, posB)
        const dist = Math.max(diff.length(), 0.1)
        const force = repulsionStrength / (dist * dist)
        diff.normalize().multiplyScalar(force)

        velocities.get(nodes[i].id)!.add(diff)
        velocities.get(nodes[j].id)!.sub(diff)
      }
    }

    // Attraction (엣지로 연결된 노드 간)
    edges.forEach(edge => {
      const posA = positions.get(edge.source)
      const posB = positions.get(edge.target)
      if (!posA || !posB) return

      const diff = new THREE.Vector3().subVectors(posB, posA)
      const dist = diff.length()
      const force = dist * attractionStrength * (edge.weight || 0.5)
      diff.normalize().multiplyScalar(force)

      velocities.get(edge.source)!.add(diff)
      velocities.get(edge.target)!.sub(diff)
    })

    // Apply velocities
    nodes.forEach(node => {
      const pos = positions.get(node.id)!
      const vel = velocities.get(node.id)!
      vel.multiplyScalar(damping)
      pos.add(vel)
    })
  }

  return positions
}

// ============================================
// Main Component
// ============================================

export function GraphRenderer({
  nodes,
  edges,
  selectedNodeId,
  hoveredNodeId,
  onNodeClick,
  onNodeHover,
  onNodeExpand,
  onFpsUpdate,
  isDark,
  className,
}: GraphRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const composerRef = useRef<EffectComposer | null>(null)
  const nodesGroupRef = useRef<THREE.Group | null>(null)
  const edgesGroupRef = useRef<THREE.Group | null>(null)
  const particlesRef = useRef<THREE.Points | null>(null)
  const nodeObjectsRef = useRef<Map<string, THREE.Mesh>>(new Map())
  const animationFrameRef = useRef<number>(0)

  const { accentColor } = useThemeStore()
  const accent = useMemo(() => {
    const found = accentColors.find(c => c.id === accentColor)
    return found ? found.color : '#3b82f6'
  }, [accentColor])

  // 노드 위치 계산
  const nodePositions = useMemo(() => {
    if (nodes.length === 0) return new Map<string, THREE.Vector3>()
    return forceLayout(nodes, edges, 50)
  }, [nodes, edges])

  // Scene 초기화
  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(isDark ? '#09090b' : '#fafafa')
    scene.fog = new THREE.FogExp2(isDark ? '#09090b' : '#fafafa', 0.002)
    sceneRef.current = scene

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000)
    camera.position.set(0, 0, 300)
    cameraRef.current = camera

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Post-processing
    const composer = new EffectComposer(renderer)
    const renderPass = new RenderPass(scene, camera)
    composer.addPass(renderPass)

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.8, // strength
      0.4, // radius
      0.85 // threshold
    )
    composer.addPass(bloomPass)
    composerRef.current = composer

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.rotateSpeed = 0.5
    controls.zoomSpeed = 0.8
    controls.panSpeed = 0.5
    controlsRef.current = controls

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(100, 100, 100)
    scene.add(directionalLight)

    const pointLight = new THREE.PointLight(new THREE.Color(accent), 1, 500)
    pointLight.position.set(0, 0, 0)
    scene.add(pointLight)

    // Node/Edge Groups
    const nodesGroup = new THREE.Group()
    const edgesGroup = new THREE.Group()
    scene.add(nodesGroup)
    scene.add(edgesGroup)
    nodesGroupRef.current = nodesGroup
    edgesGroupRef.current = edgesGroup

    // Particles (우주 분위기)
    const particleCount = 2000
    const particleGeometry = new THREE.BufferGeometry()
    const particlePositions = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 1000
      particlePositions[i + 1] = (Math.random() - 0.5) * 1000
      particlePositions[i + 2] = (Math.random() - 0.5) * 1000
    }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
    const particleMaterial = new THREE.PointsMaterial({
      color: isDark ? 0x444444 : 0xcccccc,
      size: 0.5,
      transparent: true,
      opacity: 0.6,
    })
    const particles = new THREE.Points(particleGeometry, particleMaterial)
    scene.add(particles)
    particlesRef.current = particles

    // Animation loop
    let lastTime = performance.now()
    let frameCount = 0

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate)

      // FPS 계산
      frameCount++
      const now = performance.now()
      if (now - lastTime >= 1000) {
        onFpsUpdate?.(frameCount)
        frameCount = 0
        lastTime = now
      }

      controls.update()

      // 파티클 회전
      if (particles) {
        particles.rotation.y += 0.0001
        particles.rotation.x += 0.00005
      }

      composer.render()
    }
    animate()

    // Resize handler
    const handleResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
      composer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameRef.current)
      window.removeEventListener('resize', handleResize)
      controls.dispose()
      renderer.dispose()
      container.removeChild(renderer.domElement)
    }
  }, [isDark, accent])

  // 노드/엣지 업데이트
  useEffect(() => {
    if (!nodesGroupRef.current || !edgesGroupRef.current) return

    const nodesGroup = nodesGroupRef.current
    const edgesGroup = edgesGroupRef.current

    // Clear existing
    while (nodesGroup.children.length > 0) {
      nodesGroup.remove(nodesGroup.children[0])
    }
    while (edgesGroup.children.length > 0) {
      edgesGroup.remove(edgesGroup.children[0])
    }
    nodeObjectsRef.current.clear()

    // Create nodes (단일 accent 색상 사용)
    const baseColor = new THREE.Color(accent)

    nodes.forEach(node => {
      const pos = nodePositions.get(node.id)
      if (!pos) return

      // 밝기로 타입 구분 (rainbow 대신)
      const brightness = NODE_TYPE_BRIGHTNESS[node.type] || 0.8
      const color = baseColor.clone().multiplyScalar(brightness)
      const size = 3 + (node.importance || 5) * 0.5

      // Main sphere
      const geometry = new THREE.SphereGeometry(size, 32, 32)
      const material = new THREE.MeshPhongMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.4,
        shininess: 100,
        transparent: true,
        opacity: 0.9,
      })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.copy(pos)
      mesh.userData = { nodeId: node.id, type: node.type }

      // Glow sphere (우주 분위기)
      const glowGeometry = new THREE.SphereGeometry(size * 1.8, 24, 24)
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: baseColor,
        transparent: true,
        opacity: 0.12,
      })
      const glow = new THREE.Mesh(glowGeometry, glowMaterial)
      mesh.add(glow)

      nodesGroup.add(mesh)
      nodeObjectsRef.current.set(node.id, mesh)
    })

    // Create edges (accent 색상 기반)
    edges.forEach(edge => {
      const sourcePos = nodePositions.get(edge.source)
      const targetPos = nodePositions.get(edge.target)
      if (!sourcePos || !targetPos) return

      const points = [sourcePos, targetPos]
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      const edgeColor = baseColor.clone().multiplyScalar(0.4)
      const material = new THREE.LineBasicMaterial({
        color: edgeColor,
        transparent: true,
        opacity: 0.2 + (edge.weight || 0.5) * 0.3,
        linewidth: 1,
      })
      const line = new THREE.Line(geometry, material)
      edgesGroup.add(line)
    })
  }, [nodes, edges, nodePositions, isDark, accent])

  // 선택/호버 상태 업데이트
  useEffect(() => {
    nodeObjectsRef.current.forEach((mesh, nodeId) => {
      const material = mesh.material as THREE.MeshPhongMaterial
      const isSelected = nodeId === selectedNodeId
      const isHovered = nodeId === hoveredNodeId

      if (isSelected) {
        material.emissiveIntensity = 0.8
        mesh.scale.setScalar(1.3)
      } else if (isHovered) {
        material.emissiveIntensity = 0.5
        mesh.scale.setScalar(1.15)
      } else {
        material.emissiveIntensity = 0.3
        mesh.scale.setScalar(1)
      }
    })
  }, [selectedNodeId, hoveredNodeId])

  // 마우스 이벤트
  useEffect(() => {
    if (!containerRef.current || !cameraRef.current || !sceneRef.current) return

    const container = containerRef.current
    const camera = cameraRef.current
    const scene = sceneRef.current
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    const handleMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)
      const intersects = raycaster.intersectObjects(nodesGroupRef.current?.children || [], true)

      if (intersects.length > 0) {
        let obj = intersects[0].object
        while (obj.parent && !obj.userData.nodeId) {
          obj = obj.parent as THREE.Mesh
        }
        if (obj.userData.nodeId) {
          onNodeHover(obj.userData.nodeId)
          container.style.cursor = 'pointer'
        }
      } else {
        onNodeHover(null)
        container.style.cursor = 'default'
      }
    }

    const handleClick = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)
      const intersects = raycaster.intersectObjects(nodesGroupRef.current?.children || [], true)

      if (intersects.length > 0) {
        let obj = intersects[0].object
        while (obj.parent && !obj.userData.nodeId) {
          obj = obj.parent as THREE.Mesh
        }
        if (obj.userData.nodeId) {
          onNodeClick(obj.userData.nodeId)
        }
      }
    }

    const handleDoubleClick = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)
      const intersects = raycaster.intersectObjects(nodesGroupRef.current?.children || [], true)

      if (intersects.length > 0) {
        let obj = intersects[0].object
        while (obj.parent && !obj.userData.nodeId) {
          obj = obj.parent as THREE.Mesh
        }
        if (obj.userData.nodeId) {
          onNodeExpand?.(obj.userData.nodeId)

          // 카메라 이동
          const pos = obj.position
          if (controlsRef.current) {
            controlsRef.current.target.copy(pos)
          }
        }
      }
    }

    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('click', handleClick)
    container.addEventListener('dblclick', handleDoubleClick)

    return () => {
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('click', handleClick)
      container.removeEventListener('dblclick', handleDoubleClick)
    }
  }, [onNodeClick, onNodeHover, onNodeExpand])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    />
  )
}

export default GraphRenderer

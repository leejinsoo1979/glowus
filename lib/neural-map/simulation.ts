// @ts-nocheck
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceRadial,
  type ForceSimulation3D,
  type ForceNode3D,
  type ForceLink3D,
} from 'd3-force-3d'
import type { NeuralNode, NeuralEdge, NodeType } from './types'
import { FORCE_SETTINGS, NODE_THRESHOLDS } from './constants'

// Simulation node with position data
export interface SimNode extends ForceNode3D {
  id: string
  type: NodeType
  importance: number
  clusterId?: string
  // Computed positions
  x: number
  y: number
  z: number
  // Velocities
  vx: number
  vy: number
  vz: number
  // Fixed positions (for pinned nodes)
  fx: number | null
  fy: number | null
  fz: number | null
}

// Simulation link
export interface SimLink extends ForceLink3D<SimNode> {
  id: string
  strength: number
  source: SimNode | string
  target: SimNode | string
}

// Helper to get node ID from link source/target
function getNodeId(nodeRef: SimNode | string | number): string {
  if (typeof nodeRef === 'string') return nodeRef
  if (typeof nodeRef === 'number') return String(nodeRef)
  return nodeRef.id
}

// Simulation state
export interface SimulationState {
  nodes: SimNode[]
  links: SimLink[]
  alpha: number
  isRunning: boolean
}

// Simulation options
export interface SimulationOptions {
  nodeCount: number
  enableRadialLayout: boolean
  centerNodeId?: string
  onTick?: (state: SimulationState) => void
  onEnd?: () => void
}

/**
 * Neural Map Force Simulation
 * Uses d3-force-3d for physics calculations
 */
export class NeuralMapSimulation {
  private simulation: ForceSimulation3D<SimNode> | null = null
  private nodes: SimNode[] = []
  private links: SimLink[] = []
  private options: SimulationOptions
  private isRunning = false
  private animationFrameId: number | null = null

  constructor(options: SimulationOptions) {
    this.options = options
  }

  /**
   * Initialize simulation with nodes and edges
   */
  init(nodes: NeuralNode[], edges: NeuralEdge[]): void {
    // Convert to simulation nodes
    this.nodes = nodes.map((node) => ({
      id: node.id,
      type: node.type,
      importance: node.importance,
      clusterId: node.clusterId,
      x: node.position?.x ?? (Math.random() - 0.5) * 100,
      y: node.position?.y ?? (Math.random() - 0.5) * 100,
      z: node.position?.z ?? (Math.random() - 0.5) * 100,
      vx: 0,
      vy: 0,
      vz: 0,
      fx: node.pinned ? (node.position?.x ?? 0) : null,
      fy: node.pinned ? (node.position?.y ?? 0) : null,
      fz: node.pinned ? (node.position?.z ?? 0) : null,
    }))

    // Convert to simulation links
    this.links = edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      strength: edge.weight,
    }))

    // Create simulation
    this.simulation = this.createSimulation()
  }

  /**
   * Create d3-force-3d simulation with configured forces
   */
  private createSimulation(): ForceSimulation3D<SimNode> {
    const { nodeCount, enableRadialLayout, centerNodeId } = this.options
    const settings = FORCE_SETTINGS

    // Create base simulation
    const sim = forceSimulation<SimNode>(this.nodes)
      .numDimensions(3)
      .alphaDecay(settings.alphaDecay)
      .velocityDecay(settings.velocityDecay)

    // Link force
    const linkForce = forceLink<SimNode, SimLink>(this.links)
      .id((d) => d.id)
      .distance((link: SimLink) => {
        // Adjust distance based on node importance
        const sourceNode = this.nodes.find((n) => n.id === getNodeId(link.source))
        const targetNode = this.nodes.find((n) => n.id === getNodeId(link.target))
        const avgImportance = ((sourceNode?.importance ?? 50) + (targetNode?.importance ?? 50)) / 2
        return settings.linkDistance * (1 + (100 - avgImportance) / 100)
      })
      .strength((link: SimLink) => link.strength * settings.linkStrength)

    sim.force('link', linkForce)

    // Many-body force (repulsion)
    const chargeForce = forceManyBody<SimNode>()
      .strength((node) => {
        // More important nodes have stronger repulsion
        const baseStrength = settings.chargeStrength
        const importanceMultiplier = 1 + node.importance / 100
        return baseStrength * importanceMultiplier
      })
      .theta(settings.theta)
      .distanceMax(settings.distanceMax)

    sim.force('charge', chargeForce)

    // Center force
    sim.force('center', forceCenter<SimNode>(0, 0, 0))

    // Collision force for large graphs
    if (nodeCount > NODE_THRESHOLDS.LOD_MEDIUM) {
      const collideForce = forceCollide<SimNode>()
        .radius((node) => {
          // Radius based on importance
          const baseRadius = 2
          return baseRadius + node.importance / 50
        })
        .strength(0.7)
        .iterations(1)

      sim.force('collide', collideForce)
    }

    // Radial layout for center node
    if (enableRadialLayout && centerNodeId) {
      const centerNode = this.nodes.find((n) => n.id === centerNodeId)
      if (centerNode) {
        // Pin center node to (0,0,0) explicitly
        centerNode.fx = 0
        centerNode.fy = 0
        centerNode.fz = 0

        // ... (rest of radial logic)

        const radialForce = forceRadial<SimNode>(
          (node) => {
            if (node.id === centerNodeId) return 0
            // Distance based on connection to center
            const isConnected = this.links.some(
              (l) =>
                getNodeId(l.source) === centerNodeId &&
                getNodeId(l.target) === node.id
            )
            return isConnected ? 30 : 60
          },
          0,
          0,
          0
        ).strength(0.1)

        sim.force('radial', radialForce)
      }
    }

    return sim
  }

  /**
   * Start simulation
   */
  start(): void {
    if (!this.simulation || this.isRunning) return

    this.isRunning = true
    this.simulation.alpha(1).restart()

    // Animation loop
    const tick = () => {
      if (!this.simulation || !this.isRunning) return

      const alpha = this.simulation.alpha()

      // Call onTick callback
      this.options.onTick?.({
        nodes: this.nodes,
        links: this.links,
        alpha,
        isRunning: alpha > this.simulation.alphaMin(),
      })

      // Continue animation if not converged
      if (alpha > this.simulation.alphaMin()) {
        this.animationFrameId = requestAnimationFrame(tick)
      } else {
        this.isRunning = false
        this.options.onEnd?.()
      }
    }

    this.animationFrameId = requestAnimationFrame(tick)
  }

  /**
   * Stop simulation
   */
  stop(): void {
    if (this.simulation) {
      this.simulation.stop()
    }
    this.isRunning = false
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  /**
   * Reheat simulation (restart with lower alpha)
   */
  reheat(alpha = 0.3): void {
    if (!this.simulation) return
    this.simulation.alpha(alpha)
    if (!this.isRunning) {
      this.start()
    }
  }

  /**
   * Update nodes (for drag, add, remove)
   */
  updateNodes(nodes: NeuralNode[]): void {
    // Keep existing positions for nodes that still exist
    const existingPositions = new Map(
      this.nodes.map((n) => [n.id, { x: n.x, y: n.y, z: n.z, fx: n.fx, fy: n.fy, fz: n.fz }])
    )

    this.nodes = nodes.map((node) => {
      const existing = existingPositions.get(node.id)
      return {
        id: node.id,
        type: node.type,
        importance: node.importance,
        clusterId: node.clusterId,
        x: existing?.x ?? node.position?.x ?? (Math.random() - 0.5) * 100,
        y: existing?.y ?? node.position?.y ?? (Math.random() - 0.5) * 100,
        z: existing?.z ?? node.position?.z ?? (Math.random() - 0.5) * 100,
        vx: 0,
        vy: 0,
        vz: 0,
        fx: node.pinned ? (existing?.fx ?? node.position?.x ?? 0) : null,
        fy: node.pinned ? (existing?.fy ?? node.position?.y ?? 0) : null,
        fz: node.pinned ? (existing?.fz ?? node.position?.z ?? 0) : null,
      }
    })

    if (this.simulation) {
      this.simulation.nodes(this.nodes)
      this.reheat(0.5)
    }
  }

  /**
   * Update edges
   */
  updateEdges(edges: NeuralEdge[]): void {
    this.links = edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      strength: edge.weight,
    }))

    if (this.simulation) {
      const linkForce = this.simulation.force('link') as ReturnType<typeof forceLink>
      if (linkForce) {
        linkForce.links(this.links)
      }
      this.reheat(0.3)
    }
  }

  /**
   * Pin/unpin a node
   */
  pinNode(nodeId: string, pinned: boolean, position?: { x: number; y: number; z: number }): void {
    const node = this.nodes.find((n) => n.id === nodeId)
    if (!node) return

    if (pinned) {
      node.fx = position?.x ?? node.x
      node.fy = position?.y ?? node.y
      node.fz = position?.z ?? node.z
    } else {
      node.fx = null
      node.fy = null
      node.fz = null
    }
  }

  /**
   * Drag node to position
   */
  dragNode(nodeId: string, position: { x: number; y: number; z: number }): void {
    const node = this.nodes.find((n) => n.id === nodeId)
    if (!node) return

    node.fx = position.x
    node.fy = position.y
    node.fz = position.z

    this.reheat(0.1)
  }

  /**
   * End drag (release fixed position unless pinned)
   */
  endDrag(nodeId: string, keepPinned = false): void {
    const node = this.nodes.find((n) => n.id === nodeId)
    if (!node) return

    if (!keepPinned) {
      node.fx = null
      node.fy = null
      node.fz = null
    }
  }

  /**
   * Find node at position
   */
  findNodeAt(x: number, y: number, z: number, radius = 10): SimNode | undefined {
    return this.simulation?.find(x, y, z, radius)
  }

  /**
   * Get current node positions
   */
  getPositions(): Map<string, { x: number; y: number; z: number }> {
    const positions = new Map<string, { x: number; y: number; z: number }>()
    for (const node of this.nodes) {
      positions.set(node.id, { x: node.x, y: node.y, z: node.z })
    }
    return positions
  }

  /**
   * Get simulation state
   */
  getState(): SimulationState {
    return {
      nodes: this.nodes,
      links: this.links,
      alpha: this.simulation?.alpha() ?? 0,
      isRunning: this.isRunning,
    }
  }

  /**
   * Dispose simulation
   */
  dispose(): void {
    this.stop()
    this.simulation = null
    this.nodes = []
    this.links = []
  }
}

/**
 * Create simulation instance
 */
export function createSimulation(options: SimulationOptions): NeuralMapSimulation {
  return new NeuralMapSimulation(options)
}

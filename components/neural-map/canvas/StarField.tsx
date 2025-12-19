// @ts-nocheck
'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface StarFieldProps {
  count?: number
  radius?: number
  color?: string
  twinkle?: boolean
}

export function StarField({
  count = 2000,
  radius = 800,
  color = '#ffffff',
  twinkle = true,
}: StarFieldProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  // Generate star positions
  const { positions, sizes, phases } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const phases = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      // Spherical distribution
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = radius * (0.5 + Math.random() * 0.5)

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)

      // Random sizes for depth effect - larger stars
      sizes[i] = Math.random() * 4 + 1.5

      // Random phase for twinkling
      phases[i] = Math.random() * Math.PI * 2
    }

    return { positions, sizes, phases }
  }, [count, radius])

  // Custom shader for stars with twinkle effect
  const starMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(color) },
        uTwinkle: { value: twinkle ? 1.0 : 0.0 },
      },
      vertexShader: `
        attribute float size;
        attribute float phase;
        uniform float uTime;
        uniform float uTwinkle;
        varying float vAlpha;

        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

          // Twinkle effect
          float twinkle = uTwinkle * sin(uTime * 2.0 + phase) * 0.3 + 0.7;
          vAlpha = twinkle;

          // Size attenuation - increased multiplier for visibility
          gl_PointSize = size * (500.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;

        void main() {
          // Circular star shape with soft edges
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;

          float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
          alpha *= vAlpha;

          // Add slight glow
          vec3 glowColor = uColor + vec3(0.2, 0.2, 0.3);

          gl_FragColor = vec4(glowColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  }, [color, twinkle])

  // Animate twinkling
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
    }
    // Slow rotation for depth effect
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.01
    }
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={sizes}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-phase"
          count={count}
          array={phases}
          itemSize={1}
        />
      </bufferGeometry>
      <primitive object={starMaterial} ref={materialRef} attach="material" />
    </points>
  )
}

// Nebula cloud effect
export function NebulaCloud({
  position = [0, 0, -200],
  color = '#0a2040',
  opacity = 0.15,
  scale = 300,
}: {
  position?: [number, number, number]
  color?: string
  opacity?: number
  scale?: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.z = state.clock.elapsedTime * 0.02
    }
  })

  return (
    <mesh ref={meshRef} position={position} scale={scale}>
      <planeGeometry args={[2, 2, 1, 1]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  )
}

export default StarField

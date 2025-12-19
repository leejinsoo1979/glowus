// @ts-nocheck
'use client'

import { useRef, useEffect, useCallback } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import { CAMERA_SETTINGS, ANIMATION_DURATIONS } from '@/lib/neural-map/constants'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'

interface CameraControllerProps {
  enableDamping?: boolean
  dampingFactor?: number
  enableZoom?: boolean
  enablePan?: boolean
  enableRotate?: boolean
  minDistance?: number
  maxDistance?: number
  autoRotate?: boolean
  autoRotateSpeed?: number
}

export function CameraController({
  enableDamping = true,
  dampingFactor = 0.1,
  enableZoom = true,
  enablePan = true,
  enableRotate = true,
  minDistance = CAMERA_SETTINGS.minDistance,
  maxDistance = CAMERA_SETTINGS.maxDistance,
  autoRotate = false,
  autoRotateSpeed = 0.5,
}: CameraControllerProps) {
  const controlsRef = useRef<OrbitControlsType>(null)
  const { camera, gl } = useThree()

  // Store camera state
  const cameraState = useNeuralMapStore((s) => s.cameraState)
  const setCameraState = useNeuralMapStore((s) => s.setCameraState)

  // Animation state
  const isAnimating = useRef(false)
  const animationStart = useRef<{
    position: THREE.Vector3
    target: THREE.Vector3
    startTime: number
    duration: number
    endPosition: THREE.Vector3
    endTarget: THREE.Vector3
  } | null>(null)

  // Initialize camera position from store
  useEffect(() => {
    if (cameraState) {
      camera.position.set(cameraState.position.x, cameraState.position.y, cameraState.position.z)
      if (controlsRef.current) {
        controlsRef.current.target.set(
          cameraState.target.x,
          cameraState.target.y,
          cameraState.target.z
        )
      }
    } else {
      // Default position
      camera.position.set(
        CAMERA_SETTINGS.defaultPosition.x,
        CAMERA_SETTINGS.defaultPosition.y,
        CAMERA_SETTINGS.defaultPosition.z
      )
    }
  }, [camera, cameraState])

  // Save camera state on change
  const handleChange = useCallback(() => {
    if (isAnimating.current || !controlsRef.current) return

    setCameraState({
      position: {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      },
      target: {
        x: controlsRef.current.target.x,
        y: controlsRef.current.target.y,
        z: controlsRef.current.target.z,
      },
      zoom: camera.zoom,
    })
  }, [camera, setCameraState])

  // Animate camera to position
  const animateTo = useCallback(
    (
      targetPosition: THREE.Vector3,
      targetLookAt: THREE.Vector3,
      duration = ANIMATION_DURATIONS.cameraMove
    ) => {
      if (!controlsRef.current) return

      isAnimating.current = true
      animationStart.current = {
        position: camera.position.clone(),
        target: controlsRef.current.target.clone(),
        startTime: performance.now(),
        duration,
        endPosition: targetPosition,
        endTarget: targetLookAt,
      }
    },
    [camera]
  )

  // Focus on a specific position
  const focusOn = useCallback(
    (position: THREE.Vector3, distance = 30) => {
      // Calculate camera position at a distance from the target
      const direction = camera.position.clone().sub(controlsRef.current?.target || new THREE.Vector3())
      direction.normalize()
      const newCameraPos = position.clone().add(direction.multiplyScalar(distance))

      animateTo(newCameraPos, position)
    },
    [camera, animateTo]
  )

  // Reset camera to default position
  const resetCamera = useCallback(() => {
    const defaultPos = new THREE.Vector3(
      CAMERA_SETTINGS.defaultPosition.x,
      CAMERA_SETTINGS.defaultPosition.y,
      CAMERA_SETTINGS.defaultPosition.z
    )
    const origin = new THREE.Vector3(0, 0, 0)
    animateTo(defaultPos, origin)
  }, [animateTo])

  // Expose methods through store or context
  useEffect(() => {
    // You could expose these methods through a context or store
    // For now, we'll use keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // R key to reset camera
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
        resetCamera()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [resetCamera])

  // Handle animation in frame loop
  useFrame(() => {
    if (!isAnimating.current || !animationStart.current || !controlsRef.current) return

    const { position, target, startTime, duration, endPosition, endTarget } = animationStart.current
    const elapsed = performance.now() - startTime
    const progress = Math.min(elapsed / duration, 1)

    // Easing function (ease-out cubic)
    const eased = 1 - Math.pow(1 - progress, 3)

    // Interpolate position
    camera.position.lerpVectors(position, endPosition, eased)

    // Interpolate target
    controlsRef.current.target.lerpVectors(target, endTarget, eased)

    // Update controls
    controlsRef.current.update()

    // Check if animation is complete
    if (progress >= 1) {
      isAnimating.current = false
      animationStart.current = null
      handleChange()
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      args={[camera, gl.domElement]}
      enableDamping={enableDamping}
      dampingFactor={dampingFactor}
      enableZoom={enableZoom}
      enablePan={enablePan}
      enableRotate={enableRotate}
      minDistance={minDistance}
      maxDistance={maxDistance}
      autoRotate={autoRotate}
      autoRotateSpeed={autoRotateSpeed}
      // Limit vertical rotation to prevent flipping
      minPolarAngle={Math.PI * 0.1}
      maxPolarAngle={Math.PI * 0.9}
      onChange={handleChange}
      // Enable touch controls
      touches={{
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
    />
  )
}

// Hook to access camera controls
export function useCameraControls() {
  const { camera } = useThree()
  const setCameraState = useNeuralMapStore((s) => s.setCameraState)

  const focusOn = useCallback(
    (position: { x: number; y: number; z: number }, distance = 30) => {
      const targetPos = new THREE.Vector3(position.x, position.y, position.z)
      const direction = camera.position.clone().sub(targetPos).normalize()
      const newCameraPos = targetPos.clone().add(direction.multiplyScalar(distance))

      // Animate using tween or directly set
      camera.position.copy(newCameraPos)
      setCameraState({
        position: { x: newCameraPos.x, y: newCameraPos.y, z: newCameraPos.z },
        target: position,
        zoom: camera.zoom,
      })
    },
    [camera, setCameraState]
  )

  const resetCamera = useCallback(() => {
    camera.position.set(
      CAMERA_SETTINGS.defaultPosition.x,
      CAMERA_SETTINGS.defaultPosition.y,
      CAMERA_SETTINGS.defaultPosition.z
    )
    setCameraState({
      position: CAMERA_SETTINGS.defaultPosition,
      target: { x: 0, y: 0, z: 0 },
      zoom: 1,
    })
  }, [camera, setCameraState])

  return { focusOn, resetCamera }
}

export default CameraController

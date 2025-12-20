import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { CAMERA_SETTINGS } from '@/lib/neural-map/constants'

// Component to reset camera focus to center
export function CameraResetter() {
    const { camera, controls } = useThree()

    useEffect(() => {
        // Reset camera to default position
        camera.position.set(
            CAMERA_SETTINGS.defaultPosition.x,
            CAMERA_SETTINGS.defaultPosition.y,
            CAMERA_SETTINGS.defaultPosition.z
        )
        camera.lookAt(0, 0, 0)

        // Reset controls target if available (OrbitControls)
        if (controls) {
            // @ts-ignore
            controls.target.set(0, 0, 0)
            // @ts-ignore
            controls.update()
        }
    }, [camera, controls])

    return null
}

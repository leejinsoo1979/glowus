import { LandingPage } from './landing-page'

// Force dynamic rendering to avoid Spline/3D library prerendering issues
export const dynamic = 'force-dynamic'

export default function Page() {
  return <LandingPage />
}

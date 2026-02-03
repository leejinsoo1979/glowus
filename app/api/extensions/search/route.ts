/**
 * VSCode Marketplace API Proxy
 * Searches for extensions from the official marketplace
 */

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const MARKETPLACE_URL = 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery'

interface MarketplaceExtension {
  extensionId: string
  extensionName: string
  displayName: string
  shortDescription: string
  publisher: {
    publisherId: string
    publisherName: string
    displayName: string
  }
  versions: Array<{
    version: string
    files: Array<{
      assetType: string
      source: string
    }>
  }>
  statistics: Array<{
    statisticName: string
    value: number
  }>
  categories: string[]
  tags: string[]
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q') || ''
  const category = searchParams.get('category') || ''

  try {
    // Build filter criteria
    const criteria: any[] = []

    if (query) {
      criteria.push({
        filterType: 10, // SearchText
        value: query
      })
    }

    if (category === 'popular') {
      // Sort by install count for popular
      criteria.push({
        filterType: 12, // ExtensionName
        value: ''
      })
    }

    const response = await fetch(MARKETPLACE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json;api-version=7.1-preview.1',
      },
      body: JSON.stringify({
        assetTypes: ['Microsoft.VisualStudio.Services.Icons.Default', 'Microsoft.VisualStudio.Services.Icons.Small'],
        filters: [{
          criteria: criteria.length > 0 ? criteria : [
            { filterType: 8, value: 'Microsoft.VisualStudio.Code' }, // Target VSCode
            { filterType: 12, value: '' } // All extensions
          ],
          pageNumber: 1,
          pageSize: 30,
          sortBy: 4, // InstallCount
          sortOrder: 2 // Descending
        }],
        flags: 914 // Include statistics, versions, files
      })
    })

    if (!response.ok) {
      throw new Error(`Marketplace API error: ${response.status}`)
    }

    const data = await response.json()
    const extensions = data.results?.[0]?.extensions || []

    // Transform to our format
    const transformed = extensions.map((ext: MarketplaceExtension) => {
      const installCount = ext.statistics?.find(s => s.statisticName === 'install')?.value || 0
      const rating = ext.statistics?.find(s => s.statisticName === 'averagerating')?.value || 0
      const ratingCount = ext.statistics?.find(s => s.statisticName === 'ratingcount')?.value || 0

      // Get icon URL
      const iconFile = ext.versions?.[0]?.files?.find(
        f => f.assetType === 'Microsoft.VisualStudio.Services.Icons.Small' ||
             f.assetType === 'Microsoft.VisualStudio.Services.Icons.Default'
      )

      return {
        id: `${ext.publisher.publisherName}.${ext.extensionName}`,
        name: ext.extensionName,
        displayName: ext.displayName,
        description: ext.shortDescription || '',
        publisher: ext.publisher.displayName,
        publisherId: ext.publisher.publisherName,
        version: ext.versions?.[0]?.version || '1.0.0',
        iconUrl: iconFile?.source || null,
        installCount,
        rating: Math.round(rating * 10) / 10,
        ratingCount,
        categories: ext.categories || [],
        tags: ext.tags || [],
      }
    })

    return NextResponse.json(transformed)
  } catch (error: any) {
    console.error('[Extensions API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch extensions' },
      { status: 500 }
    )
  }
}

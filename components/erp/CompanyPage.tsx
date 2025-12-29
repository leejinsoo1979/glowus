'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Building2, Save, Loader2, MapPin, Phone, Mail, Globe, Calendar, Briefcase, FileText, Upload, Sparkles, Image as ImageIcon, X, Plus, Download, ZoomIn, ImagePlus } from 'lucide-react'
import { useCompany, useMutation, useLocations } from '@/lib/erp/hooks'
import { PageHeader, FormField, FormInput, FormSelect, FormTextarea, FormRow, StatCard, StatGrid } from './shared'
import type { Company } from '@/lib/erp/types'
import { createClient } from '@/lib/supabase/client'

export function CompanyPage() {
  const { data: company, loading, refresh } = useCompany()
  const { data: locations } = useLocations()
  const { loading: saving, create, mutate } = useMutation<Partial<Company>>('/api/erp/company')

  const [ocrLoading, setOcrLoading] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [companyLogo, setCompanyLogo] = useState<string | null>(null)
  const [customTabs, setCustomTabs] = useState<{ id: string; name: string; files: { name: string; url: string }[] }[]>([])
  const [activeTab, setActiveTab] = useState<string>('business')
  const [showImageModal, setShowImageModal] = useState(false)
  const [modalImage, setModalImage] = useState<string | null>(null)
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingTabName, setEditingTabName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const tabFileInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // 회사 데이터 로드 시 이미지 URL 설정
  useEffect(() => {
    if (company) {
      // 로고 로드: DB → localStorage
      const logoUrl = company.logo_url ||
        (typeof window !== 'undefined' ? localStorage.getItem(`company_${company.id}_logo_url`) : null)
      if (logoUrl) {
        setCompanyLogo(logoUrl)
      }
      // 사업자등록증 로드: DB → localStorage
      const businessRegUrl = company.business_registration_url ||
        (company.settings as any)?.business_registration_url ||
        (typeof window !== 'undefined' ? localStorage.getItem(`company_${company.id}_business_registration_url`) : null)
      if (businessRegUrl) {
        setUploadedImage(businessRegUrl)
      }
    }
  }, [company])

  // 서버 API를 통한 파일 업로드
  const uploadToStorage = async (file: File | Blob, folder: string, fileName: string): Promise<string | null> => {
    try {
      const formData = new FormData()
      formData.append('file', file, fileName)
      formData.append('folder', folder)
      if (company?.id) {
        formData.append('companyId', company.id)
      }

      const response = await fetch('/api/erp/upload', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!result.success) {
        console.error('Upload error:', result.error)
        return null
      }

      console.log('✅ 업로드 성공:', result.url)
      return result.url
    } catch (error) {
      console.error('Storage upload error:', error)
      return null
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 즉시 미리보기 표시
    const reader = new FileReader()
    reader.onload = (event) => {
      setCompanyLogo(event.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Storage에 업로드
    const url = await uploadToStorage(file, 'logos', file.name)
    if (url) {
      setCompanyLogo(url)
      // localStorage에 즉시 저장 (백업)
      if (company?.id && typeof window !== 'undefined') {
        localStorage.setItem(`company_${company.id}_logo_url`, url)
      }
      // DB에 즉시 저장
      if (company?.id) {
        try {
          await mutate('PUT', { logo_url: url })
          refresh()
        } catch (err) {
          console.error('로고 저장 실패:', err)
        }
      }
    }

    if (logoInputRef.current) {
      logoInputRef.current.value = ''
    }
  }

  const [formData, setFormData] = useState<Partial<Company>>({
    name: '',
    business_number: '',
    corporate_number: '',
    ceo_name: '',
    phone: '',
    fax: '',
    email: '',
    website: '',
    postal_code: '',
    address: '',
    address_detail: '',
    business_type: '',
    business_category: '',
    establishment_date: '',
    fiscal_year_start: 1,
  })

  useEffect(() => {
    if (company) {
      setFormData(company)
    }
  }, [company])

  const handleChange = (field: keyof Company, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    try {
      if (company?.id) {
        await mutate('PUT', formData)
      } else {
        await create(formData)
      }
      refresh()
    } catch (error) {
      console.error('Save error:', error)
    }
  }

  const convertPdfToImage = async (file: File): Promise<Blob> => {
    try {
      const pdfjsLib = await import('pdfjs-dist')

      // Worker 설정 - 여러 방법 시도
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        try {
          const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.mjs')
          pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker.default || pdfjsWorker
        } catch {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
        }
      }

      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer,
        useSystemFonts: true,
      }).promise
      const page = await pdf.getPage(1)

      const scale = 2.0
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')!
      canvas.height = viewport.height
      canvas.width = viewport.width

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise

      return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Canvas to Blob 변환 실패'))
          }
        }, 'image/png', 0.95)
      })
    } catch (error) {
      console.error('PDF 변환 오류:', error)
      throw new Error('PDF를 이미지로 변환하는데 실패했습니다. 이미지 파일(JPG, PNG)로 다시 시도해주세요.')
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setOcrLoading(true)

    // 1. 먼저 이미지 미리보기 설정 (즉시)
    const reader = new FileReader()
    reader.onload = (event) => {
      setUploadedImage(event.target?.result as string)
    }
    reader.readAsDataURL(file)

    // 2. Storage에 원본 파일 업로드 (PDF든 이미지든)
    try {
      const uploadedUrl = await uploadToStorage(file, 'business-registration', file.name)
      if (uploadedUrl) {
        setUploadedImage(uploadedUrl)
        // localStorage에 저장
        if (company?.id && typeof window !== 'undefined') {
          localStorage.setItem(`company_${company.id}_business_registration_url`, uploadedUrl)
        }
        console.log('✅ 파일 저장 완료:', uploadedUrl)
      }
    } catch (uploadError) {
      console.error('파일 업로드 실패:', uploadError)
    }

    // 3. OCR 처리 (별도 try-catch로 분리 - 실패해도 저장은 완료됨)
    try {
      let fileToSend: File | Blob = file
      let fileName = file.name

      // PDF인 경우 이미지로 변환 시도
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        console.log('PDF 파일 감지, OCR용 이미지 변환 중...')
        try {
          const imageBlob = await convertPdfToImage(file)
          fileToSend = new File([imageBlob], 'converted.png', { type: 'image/png' })
          fileName = 'converted.png'
        } catch (pdfError) {
          console.error('PDF 변환 실패, OCR 건너뜀:', pdfError)
          setOcrLoading(false)
          return // PDF 변환 실패시 OCR 건너뜀 (파일 저장은 이미 완료)
        }
      }

      // OCR 요청
      const formDataToSend = new FormData()
      formDataToSend.append('file', fileToSend, fileName)

      const response = await fetch('/api/erp/ocr-business-registration', {
        method: 'POST',
        body: formDataToSend,
      })

      const result = await response.json()

      if (result.success && result.data) {
        const ocrData = result.data
        setFormData(prev => ({
          ...prev,
          name: ocrData.name || prev.name,
          business_number: ocrData.business_number || prev.business_number,
          corporate_number: ocrData.corporate_number || prev.corporate_number,
          ceo_name: ocrData.ceo_name || prev.ceo_name,
          address: ocrData.address || prev.address,
          business_type: ocrData.business_type || prev.business_type,
          business_category: ocrData.business_category || prev.business_category,
          establishment_date: ocrData.establishment_date || prev.establishment_date,
          phone: ocrData.phone || prev.phone,
        }))
      } else {
        console.error('OCR failed:', result.error, result.details)
        // OCR 실패해도 이미지는 저장됨
        console.log('이미지는 저장됨, OCR만 실패')
      }
    } catch (error: any) {
      console.error('OCR error:', error)
      // OCR 오류가 발생해도 이미지 저장은 완료됨
      console.log('이미지는 저장됨, OCR 오류 발생:', error?.message)
    } finally {
      setOcrLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleTabFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || activeTab === 'business') return

    const reader = new FileReader()
    reader.onload = (event) => {
      setCustomTabs(prev => prev.map(tab =>
        tab.id === activeTab
          ? { ...tab, files: [...tab.files, { name: file.name, url: event.target?.result as string }] }
          : tab
      ))
    }
    reader.readAsDataURL(file)

    if (tabFileInputRef.current) {
      tabFileInputRef.current.value = ''
    }
  }

  const handleImageClick = (imageUrl: string) => {
    setModalImage(imageUrl)
    setShowImageModal(true)
  }

  const handleDownload = (imageUrl: string, fileName: string) => {
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const addNewTab = () => {
    const newTab = {
      id: `tab-${Date.now()}`,
      name: '새 첨부',
      files: []
    }
    setCustomTabs(prev => [...prev, newTab])
    setActiveTab(newTab.id)
    setEditingTabId(newTab.id)
    setEditingTabName(newTab.name)
  }

  const updateTabName = (tabId: string) => {
    if (editingTabName.trim()) {
      setCustomTabs(prev => prev.map(tab =>
        tab.id === tabId ? { ...tab, name: editingTabName.trim() } : tab
      ))
    }
    setEditingTabId(null)
    setEditingTabName('')
  }

  const deleteTab = (tabId: string) => {
    setCustomTabs(prev => prev.filter(tab => tab.id !== tabId))
    if (activeTab === tabId) {
      setActiveTab('business')
    }
  }

  const removeFileFromTab = (tabId: string, fileIndex: number) => {
    setCustomTabs(prev => prev.map(tab =>
      tab.id === tabId
        ? { ...tab, files: tab.files.filter((_, i) => i !== fileIndex) }
        : tab
    ))
  }

  const getCurrentTabFiles = () => {
    const tab = customTabs.find(t => t.id === activeTab)
    return tab?.files || []
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      <PageHeader
        title="회사/기업 현황"
        subtitle="회사 정보 및 사업장 관리"
        icon={Building2}
      />

      <div className="flex-1 overflow-auto p-6">
        {/* Stats with Logo */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {/* 기업 로고 업로드 */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
              id="company-logo-upload"
            />
            <p className="text-xs text-zinc-500 mb-2">기업 로고</p>
            {companyLogo ? (
              <div className="relative group">
                <img
                  src={companyLogo}
                  alt="기업 로고"
                  className="w-full h-16 object-contain cursor-pointer"
                  onClick={() => handleImageClick(companyLogo)}
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <label htmlFor="company-logo-upload" className="p-1.5 bg-zinc-800 hover:bg-accent rounded cursor-pointer transition-colors">
                    <ImagePlus className="w-4 h-4 text-white" />
                  </label>
                  <button
                    onClick={() => setCompanyLogo(null)}
                    className="p-1.5 bg-zinc-800 hover:bg-red-600 rounded transition-colors"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            ) : (
              <label
                htmlFor="company-logo-upload"
                className="w-full h-16 border-2 border-dashed border-zinc-700 rounded-lg flex flex-col items-center justify-center text-zinc-500 cursor-pointer hover:border-accent hover:text-accent transition-colors"
              >
                <ImagePlus className="w-5 h-5" />
                <span className="text-xs mt-1">로고 업로드</span>
              </label>
            )}
          </div>
          <StatCard
            title="설립일"
            value={company?.establishment_date || '-'}
            icon={Calendar}
          />
          <StatCard
            title="사업자등록번호"
            value={company?.business_number || '-'}
            icon={FileText}
          />
          <StatCard
            title="법인등록번호"
            value={company?.corporate_number || '-'}
            icon={Briefcase}
          />
        </div>

        {/* Company Form - 2 Column Layout */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">기본 정보</h2>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                className="hidden"
                id="business-registration-upload"
              />
              <label
                htmlFor="business-registration-upload"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all ${
                  ocrLoading
                    ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                    : 'bg-accent hover:bg-accent/90 text-white'
                }`}
              >
                {ocrLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>인식 중...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>사업자등록증 업로드</span>
                  </>
                )}
              </label>
            </div>
          </div>
          <div className="flex">
            {/* Left Side - Form */}
            <div className="w-1/2 p-6 space-y-6 border-r border-zinc-800">
            {/* Basic Info */}
            <div className="space-y-4">
              <FormRow>
                <FormField label="회사명" required>
                  <FormInput
                    value={formData.name || ''}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="회사명을 입력하세요"
                  />
                </FormField>
                <FormField label="대표자명">
                  <FormInput
                    value={formData.ceo_name || ''}
                    onChange={(e) => handleChange('ceo_name', e.target.value)}
                    placeholder="대표자명을 입력하세요"
                  />
                </FormField>
              </FormRow>

              <FormRow>
                <FormField label="사업자등록번호">
                  <FormInput
                    value={formData.business_number || ''}
                    onChange={(e) => handleChange('business_number', e.target.value)}
                    placeholder="000-00-00000"
                  />
                </FormField>
                <FormField label="법인등록번호">
                  <FormInput
                    value={formData.corporate_number || ''}
                    onChange={(e) => handleChange('corporate_number', e.target.value)}
                    placeholder="000000-0000000"
                  />
                </FormField>
              </FormRow>

              <FormRow>
                <FormField label="업태">
                  <FormInput
                    value={formData.business_type || ''}
                    onChange={(e) => handleChange('business_type', e.target.value)}
                    placeholder="업태를 입력하세요"
                  />
                </FormField>
                <FormField label="업종">
                  <FormInput
                    value={formData.business_category || ''}
                    onChange={(e) => handleChange('business_category', e.target.value)}
                    placeholder="업종을 입력하세요"
                  />
                </FormField>
              </FormRow>

              <FormRow>
                <FormField label="설립일">
                  <FormInput
                    type="date"
                    value={formData.establishment_date || ''}
                    onChange={(e) => handleChange('establishment_date', e.target.value)}
                  />
                </FormField>
                <FormField label="회계연도 시작월">
                  <FormSelect
                    value={String(formData.fiscal_year_start || 1)}
                    onChange={(e) => handleChange('fiscal_year_start', parseInt(e.target.value))}
                    options={Array.from({ length: 12 }, (_, i) => ({
                      value: String(i + 1),
                      label: `${i + 1}월`,
                    }))}
                  />
                </FormField>
              </FormRow>
            </div>

            {/* Contact Info */}
            <div className="pt-6 border-t border-zinc-800">
              <h3 className="text-sm font-medium text-zinc-400 mb-4">연락처 정보</h3>
              <div className="space-y-4">
                <FormRow>
                  <FormField label="전화번호">
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <FormInput
                        className="pl-10"
                        value={formData.phone || ''}
                        onChange={(e) => handleChange('phone', e.target.value)}
                        placeholder="02-0000-0000"
                      />
                    </div>
                  </FormField>
                  <FormField label="팩스">
                    <FormInput
                      value={formData.fax || ''}
                      onChange={(e) => handleChange('fax', e.target.value)}
                      placeholder="02-0000-0000"
                    />
                  </FormField>
                </FormRow>

                <FormRow>
                  <FormField label="이메일">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <FormInput
                        type="email"
                        className="pl-10"
                        value={formData.email || ''}
                        onChange={(e) => handleChange('email', e.target.value)}
                        placeholder="info@company.com"
                      />
                    </div>
                  </FormField>
                  <FormField label="웹사이트">
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <FormInput
                        className="pl-10"
                        value={formData.website || ''}
                        onChange={(e) => handleChange('website', e.target.value)}
                        placeholder="https://company.com"
                      />
                    </div>
                  </FormField>
                </FormRow>
              </div>
            </div>

            {/* Address */}
            <div className="pt-6 border-t border-zinc-800">
              <h3 className="text-sm font-medium text-zinc-400 mb-4">주소 정보</h3>
              <div className="space-y-4">
                <FormRow>
                  <FormField label="우편번호">
                    <FormInput
                      value={formData.postal_code || ''}
                      onChange={(e) => handleChange('postal_code', e.target.value)}
                      placeholder="00000"
                    />
                  </FormField>
                  <div /> {/* Empty space */}
                </FormRow>
                <FormField label="주소">
                  <FormInput
                    value={formData.address || ''}
                    onChange={(e) => handleChange('address', e.target.value)}
                    placeholder="주소를 입력하세요"
                  />
                </FormField>
                <FormField label="상세주소">
                  <FormInput
                    value={formData.address_detail || ''}
                    onChange={(e) => handleChange('address_detail', e.target.value)}
                    placeholder="상세주소를 입력하세요"
                  />
                </FormField>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-6 border-t border-zinc-800 flex justify-end">
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                저장
              </button>
            </div>
            </div>
            {/* Right Side - Tabs */}
            <div className="w-1/2 flex flex-col">
              {/* Tabs */}
              <div className="flex border-b border-zinc-800 overflow-x-auto">
                <button
                  onClick={() => setActiveTab('business')}
                  className={`px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === 'business'
                      ? 'text-accent border-b-2 border-accent'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  사업자등록증
                </button>
                {customTabs.map(tab => (
                  <div
                    key={tab.id}
                    className={`relative group flex items-center ${
                      activeTab === tab.id
                        ? 'border-b-2 border-accent'
                        : ''
                    }`}
                  >
                    {editingTabId === tab.id ? (
                      <input
                        type="text"
                        value={editingTabName}
                        onChange={(e) => setEditingTabName(e.target.value)}
                        onBlur={() => updateTabName(tab.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') updateTabName(tab.id)
                          if (e.key === 'Escape') {
                            setEditingTabId(null)
                            setEditingTabName('')
                          }
                        }}
                        autoFocus
                        className="px-3 py-2 text-sm bg-zinc-800 text-white border border-accent rounded outline-none w-24"
                      />
                    ) : (
                      <button
                        onClick={() => setActiveTab(tab.id)}
                        onDoubleClick={() => {
                          setEditingTabId(tab.id)
                          setEditingTabName(tab.name)
                        }}
                        className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1 ${
                          activeTab === tab.id
                            ? 'text-accent'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {tab.name}
                        {tab.files.length > 0 && (
                          <span className="px-1.5 py-0.5 text-xs bg-accent rounded-full">
                            {tab.files.length}
                          </span>
                        )}
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteTab(tab.id)
                      }}
                      className="p-1 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addNewTab}
                  className="px-4 py-3 text-sm font-medium text-zinc-500 hover:text-accent transition-colors flex items-center gap-1 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  탭 추가
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 p-6">
                {activeTab === 'business' ? (
                  <div className="h-full flex items-center justify-center">
                    {uploadedImage ? (
                      <div className="relative w-full h-full">
                        <img
                          src={uploadedImage}
                          alt="사업자등록증"
                          className="w-full h-full object-contain rounded-lg border border-zinc-700 cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => handleImageClick(uploadedImage)}
                        />
                        <div className="absolute top-2 right-2 flex gap-1">
                          <button
                            onClick={() => handleImageClick(uploadedImage)}
                            className="p-2 bg-zinc-800/80 hover:bg-zinc-700 rounded-lg transition-colors"
                            title="크게 보기"
                          >
                            <ZoomIn className="w-4 h-4 text-zinc-300" />
                          </button>
                          <button
                            onClick={() => handleDownload(uploadedImage, '사업자등록증.png')}
                            className="p-2 bg-zinc-800/80 hover:bg-zinc-700 rounded-lg transition-colors"
                            title="다운로드"
                          >
                            <Download className="w-4 h-4 text-zinc-300" />
                          </button>
                          <button
                            onClick={() => setUploadedImage(null)}
                            className="p-2 bg-zinc-800/80 hover:bg-red-600 rounded-lg transition-colors"
                            title="삭제"
                          >
                            <X className="w-4 h-4 text-zinc-300" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="w-full h-full min-h-[400px] border-2 border-dashed border-zinc-700 rounded-lg flex flex-col items-center justify-center text-zinc-500 cursor-pointer hover:border-zinc-600 hover:text-zinc-400 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <ImageIcon className="w-16 h-16 mb-4 opacity-50" />
                        <p className="text-sm">사업자등록증을 업로드하세요</p>
                        <p className="text-xs mt-1 text-zinc-600">이미지 또는 PDF 파일</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full">
                    <input
                      ref={tabFileInputRef}
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleTabFileUpload}
                      className="hidden"
                      id="tab-file-upload"
                    />

                    {getCurrentTabFiles().length > 0 ? (
                      <div className="grid grid-cols-2 gap-4">
                        {getCurrentTabFiles().map((file, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={file.url}
                              alt={file.name}
                              className="w-full h-32 object-cover rounded-lg border border-zinc-700 cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => handleImageClick(file.url)}
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleImageClick(file.url)}
                                className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                              >
                                <ZoomIn className="w-4 h-4 text-white" />
                              </button>
                              <button
                                onClick={() => handleDownload(file.url, file.name)}
                                className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                              >
                                <Download className="w-4 h-4 text-white" />
                              </button>
                              <button
                                onClick={() => removeFileFromTab(activeTab, index)}
                                className="p-2 bg-zinc-800 hover:bg-red-600 rounded-lg transition-colors"
                              >
                                <X className="w-4 h-4 text-white" />
                              </button>
                            </div>
                            <p className="mt-1 text-xs text-zinc-500 truncate">{file.name}</p>
                          </div>
                        ))}
                        <label
                          htmlFor="tab-file-upload"
                          className="h-32 border-2 border-dashed border-zinc-700 rounded-lg flex flex-col items-center justify-center text-zinc-500 cursor-pointer hover:border-zinc-600 hover:text-zinc-400 transition-colors"
                        >
                          <Plus className="w-8 h-8 mb-1" />
                          <span className="text-xs">파일 추가</span>
                        </label>
                      </div>
                    ) : (
                      <label
                        htmlFor="tab-file-upload"
                        className="w-full h-full min-h-[400px] border-2 border-dashed border-zinc-700 rounded-lg flex flex-col items-center justify-center text-zinc-500 cursor-pointer hover:border-zinc-600 hover:text-zinc-400 transition-colors"
                      >
                        <Plus className="w-16 h-16 mb-4 opacity-50" />
                        <p className="text-sm">파일을 추가하세요</p>
                        <p className="text-xs mt-1 text-zinc-600">이미지 또는 PDF 파일</p>
                      </label>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {showImageModal && modalImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative max-w-5xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={modalImage}
              alt="미리보기"
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            <div className="absolute top-4 right-4 flex gap-2">
              <button
                onClick={() => handleDownload(modalImage, '다운로드.png')}
                className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                title="다운로드"
              >
                <Download className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={() => setShowImageModal(false)}
                className="p-3 bg-zinc-800 hover:bg-red-600 rounded-lg transition-colors"
                title="닫기"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

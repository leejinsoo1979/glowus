const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://zcykttygjglzyyxotzct.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjeWt0dHlnamdsenl5eG90emN0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTMzODkxNSwiZXhwIjoyMDgwOTE0OTE1fQ.SovGgYnnamWGIza0fiG0uYCzW8p4c5bG3qAeBRAz0UU'

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createDevUser() {
  console.log('Creating dev user...')

  const { data, error } = await supabase.auth.admin.createUser({
    email: 'dev@glowus.app',
    password: 'dev123456',
    email_confirm: true,
    user_metadata: {
      name: 'Developer',
      role: 'admin'
    }
  })

  if (error) {
    console.log('Error:', error.message)

    // 이미 존재하면 비밀번호 업데이트 시도
    if (error.message.includes('already exists') || error.message.includes('already registered')) {
      console.log('User already exists, updating password...')

      // 기존 사용자 목록 조회
      const { data: users } = await supabase.auth.admin.listUsers()
      const devUser = users?.users?.find(u => u.email === 'dev@glowus.app')

      if (devUser) {
        const { data: updated, error: updateError } = await supabase.auth.admin.updateUserById(
          devUser.id,
          { password: 'dev123456', email_confirm: true }
        )

        if (updateError) {
          console.log('Update error:', updateError.message)
        } else {
          console.log('User updated successfully:', updated.user?.email)
        }
      }
    }
  } else {
    console.log('User created successfully:', data.user?.email)
  }
}

createDevUser()

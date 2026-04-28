import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.formData()
    const allData: Record<string, string> = {}
    body.forEach((value, key) => {
      allData[key] = value.toString()
    })
    return NextResponse.json({ method: 'POST', data: allData })
  } catch {
    return NextResponse.json({ error: 'POST parse error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const allParams: Record<string, string> = {}
  searchParams.forEach((value, key) => {
    allParams[key] = value
  })
  return NextResponse.json({ method: 'GET', params: allParams })
}
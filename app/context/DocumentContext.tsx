'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface CurrentDocument {
  id: string
  number: string
  title: string
  status: string
  companyPrefix?: string
}

interface DocumentContextValue {
  currentDocument: CurrentDocument | null
  setCurrentDocument: (doc: CurrentDocument | null) => void
}

const DocumentContext = createContext<DocumentContextValue>({
  currentDocument: null,
  setCurrentDocument: () => {},
})

export function DocumentContextProvider({ children }: { children: ReactNode }) {
  const [currentDocument, setCurrentDocument] = useState<CurrentDocument | null>(null)
  return (
    <DocumentContext.Provider value={{ currentDocument, setCurrentDocument }}>
      {children}
    </DocumentContext.Provider>
  )
}

export function useDocumentContext() {
  return useContext(DocumentContext)
}
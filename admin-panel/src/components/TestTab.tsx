'use client'

import { useState } from 'react'

export default function TestTab() {
  const [testResult, setTestResult] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const testBackendConnection = async () => {
    setIsLoading(true)
    setTestResult('')
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
      const response = await fetch(`${apiUrl}/health`)
      
      if (response.ok) {
        const data = await response.json()
        setTestResult(`✅ Backend доступен: ${JSON.stringify(data, null, 2)}`)
      } else {
        setTestResult(`❌ Backend ошибка: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      setTestResult(`❌ Ошибка подключения: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const testGeminiConnection = async () => {
    setIsLoading(true)
    setTestResult('')
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
      const response = await fetch(`${apiUrl}/test/gemini`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Привет! Это тестовое сообщение.'
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        setTestResult(`✅ Gemini API работает: ${data.response}`)
      } else {
        const error = await response.text()
        setTestResult(`❌ Gemini API ошибка: ${error}`)
      }
    } catch (error) {
      setTestResult(`❌ Ошибка тестирования Gemini: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Тестирование системы</h2>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Проверка подключений</h3>
        
        <div className="space-y-4">
          <button
            onClick={testBackendConnection}
            disabled={isLoading}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? 'Тестирование...' : 'Тест Backend API'}
          </button>
          
          <button
            onClick={testGeminiConnection}
            disabled={isLoading}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50 ml-4"
          >
            {isLoading ? 'Тестирование...' : 'Тест Gemini API'}
          </button>
        </div>
        
        {testResult && (
          <div className="mt-4 p-4 bg-gray-100 rounded-lg">
            <h4 className="font-semibold mb-2">Результат теста:</h4>
            <pre className="text-sm whitespace-pre-wrap">{testResult}</pre>
          </div>
        )}
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Информация о системе</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold text-gray-700">Backend URL:</h4>
            <p className="text-gray-600">{process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}</p>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-700">Версия Admin Panel:</h4>
            <p className="text-gray-600">v1.0.0</p>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-700">Время на сервере:</h4>
            <p className="text-gray-600">{new Date().toLocaleString('ru-RU')}</p>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-700">User Agent:</h4>
            <p className="text-gray-600 text-sm break-all">{navigator.userAgent}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
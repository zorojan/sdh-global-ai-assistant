import { useEffect, ReactNode } from 'react';
import { useApiAgents } from '../lib/api-agents';
import { useAgent } from '../lib/state';

interface DataInitializerProps {
  children: ReactNode;
}

export default function DataInitializer({ children }: DataInitializerProps) {
  const { agents, loadAgents, loading, error } = useApiAgents();
  const setAvailableAgents = useAgent(state => state.setAvailableAgents);
  
  // Загружаем агентов при монтировании компонента
  useEffect(() => {
    loadAgents();
  }, [loadAgents]);
  
  // Синхронизируем с основным state
  useEffect(() => {
    if (agents.length > 0) {
      // Обновляем основной store с данными из API
      setAvailableAgents(agents);
    }
  }, [agents, setAvailableAgents]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка агентов...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Ошибка загрузки</h2>
            <p className="text-red-600 mb-4">{error}</p>
            <button 
              onClick={loadAgents}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              Попробовать снова
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

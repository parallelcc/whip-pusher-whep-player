import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { Video, Podcast as Broadcast } from 'lucide-react';
import WHIPPusher from './components/WHIPPusher';
import WHEPPlayer from './components/WHEPPlayer';

function PageTitle() {
  const location = useLocation();
  const path = location.pathname === '/' ? '/whip' : location.pathname;

  useEffect(() => {
    const title = path === '/whip' ? 'WHIP Pusher' : 'WHEP Player';
    document.title = title;

    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon) {
      const icon = path === '/whip' ? 
        `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%232563eb' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='8'%3E%3C/circle%3E%3Cpath d='M17.7 9.3a8 8 0 0 0-11.4 0'%3E%3C/path%3E%3Cpath d='M15.8 11.2a4 4 0 0 0-7.6 0'%3E%3C/path%3E%3Cpath d='M14 13.1a2 2 0 0 0-4 0'%3E%3C/path%3E%3C/svg%3E` :
        `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%232563eb' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m22 8-6 4 6 4V8Z'%3E%3C/path%3E%3Crect x='2' y='6' width='14' height='12' rx='2' ry='2'%3E%3C/rect%3E%3C/svg%3E`;
      favicon.setAttribute('href', icon);
    }
  }, [path]);

  return null;
}

function App() {
  return (
    <Router>
      <PageTitle />
      <div className="min-h-screen bg-gray-100">
        <nav className="bg-white shadow-md">
          <div className="max-w-4xl mx-auto px-4">
            <div className="flex space-x-8 h-16">
              <NavLink
                to="/whip"
                className={({ isActive }) =>
                  `flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                    isActive
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                  }`
                }
              >
                <Broadcast className="h-5 w-5 mr-2" />
                WHIP Pusher
              </NavLink>
              <NavLink
                to="/whep"
                className={({ isActive }) =>
                  `flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                    isActive
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                  }`
                }
              >
                <Video className="h-5 w-5 mr-2" />
                WHEP Player
              </NavLink>
            </div>
          </div>
        </nav>
        <div className="p-8">
          <Routes>
            <Route path="/" element={<Navigate to="/whip" replace />} />
            <Route path="/whip" element={<WHIPPusher />} />
            <Route path="/whep" element={<WHEPPlayer />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
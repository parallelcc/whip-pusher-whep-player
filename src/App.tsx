import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { PlayCircle, Radio } from 'lucide-react';
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
        `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLXJhZGlvLWljb24gbHVjaWRlLXJhZGlvIj48cGF0aCBkPSJNNC45IDE5LjFDMSAxNS4yIDEgOC44IDQuOSA0LjkiLz48cGF0aCBkPSJNNy44IDE2LjJjLTIuMy0yLjMtMi4zLTYuMSAwLTguNSIvPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjIiLz48cGF0aCBkPSJNMTYuMiA3LjhjMi4zIDIuMyAyLjMgNi4xIDAgOC41Ii8+PHBhdGggZD0iTTE5LjEgNC45QzIzIDguOCAyMyAxNS4xIDE5LjEgMTkiLz48L3N2Zz4=` :
        `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLWNpcmNsZS1wbGF5LWljb24gbHVjaWRlLWNpcmNsZS1wbGF5Ij48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIvPjxwb2x5Z29uIHBvaW50cz0iMTAgOCAxNiAxMiAxMCAxNiAxMCA4Ii8+PC9zdmc+`;
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
          <div className="max-w-4xl mx-auto">
            <div className="flex h-16 items-center justify-between px-8">
              <div className="flex items-center space-x-4">
                <NavLink
                  to="/whip"
                  className={({ isActive }) =>
                    `inline-flex items-center px-4 rounded-md text-sm font-medium leading-none ${
                      isActive
                        ? 'text-blue-600 bg-blue-50'
                        : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                    }`
                  }
                >
                  <Radio className="h-5 w-5 mr-2 flex-shrink-0" />
                  <span className="md:hidden leading-[40px]">WHIP</span>
                  <span className="hidden md:inline leading-[40px]">WHIP Pusher</span>
                </NavLink>
                <NavLink
                  to="/whep"
                  className={({ isActive }) =>
                    `inline-flex items-center px-4 rounded-md text-sm font-medium leading-none ${
                      isActive
                        ? 'text-blue-600 bg-blue-50'
                        : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                    }`
                  }
                >
                  <PlayCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                  <span className="md:hidden leading-[40px]">WHEP</span>
                  <span className="hidden md:inline leading-[40px]">WHEP Player</span>
                </NavLink>
              </div>
              <a
                href="https://github.com/parallelcc/whip-pusher-whep-player"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 text-gray-700 hover:text-blue-600"
                title="View on GitHub"
              >
                <svg width="20" height="20" viewBox="0 0 98 96" xmlns="http://www.w3.org/2000/svg" className="fill-current">
                  <path fillRule="evenodd" clipRule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z" />
                </svg>
              </a>
            </div>
          </div>
        </nav>
        <div className="max-w-4xl mx-auto px-8 py-8">
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
import { useState, useCallback } from 'react';
import StartScreen from './components/StartScreen';
import SubtitlePanel from './components/SubtitlePanel';
import OutlinePanel from './components/OutlinePanel';

export default function App() {
  const [sessionState, setSessionState] = useState('idle'); // idle | recording | stopped
  const [subtitles, setSubtitles] = useState([]);
  const [outline, setOutline] = useState(null);

  const handleStart = useCallback(() => {
    setSessionState('recording');
  }, []);

  const handleStop = useCallback(() => {
    setSessionState('stopped');
  }, []);

  if (sessionState === 'idle') {
    return <StartScreen onStart={handleStart} />;
  }

  return (
    <div className="flex h-screen">
      <div className="w-2/5 border-r border-gray-200 overflow-hidden">
        <SubtitlePanel
          subtitles={subtitles}
          isRecording={sessionState === 'recording'}
          onStop={handleStop}
        />
      </div>
      <div className="w-3/5 overflow-hidden">
        <OutlinePanel outline={outline} setOutline={setOutline} />
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { llmService } from './llm/LLMService';
import { timerManager, type StepTimer, type TaskTimer } from './timer/TimerManager';
import { favoriteManager, type FavoriteBreakdown } from './favorites/FavoriteManager';
import './App.css';

type Tab = 'home' | 'library' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');

  // Home tab state
  const [taskInput, setTaskInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [breakdown, setBreakdown] = useState<{ response: string; fromCache: boolean; inferenceTime: number } | null>(null);
  const [memoryUsage, setMemoryUsage] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Not initialized');
  const [loadProgress, setLoadProgress] = useState('');
  const [cacheStats, setCacheStats] = useState({ size: 0, sizeBytes: 0 });

  // Timer state
  const [activeTimer, setActiveTimer] = useState<TaskTimer | null>(null);
  const [showTimerUI, setShowTimerUI] = useState(false);

  // Library state
  const [favoritesList, setFavoritesList] = useState<FavoriteBreakdown[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Settings state

  // Parsed steps
  const [steps, setSteps] = useState<string[]>([]);
  const [estimatedTimes, setEstimatedTimes] = useState<number[]>([]);

  // Update status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(llmService.getStatus());
      setCacheStats(llmService.getCacheStats());
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Update timer display every tick
  useEffect(() => {
    const handleTick = (timer: TaskTimer) => {
      setActiveTimer(timer);
    };

    timerManager.onTick(handleTick);

    return () => {
      timerManager.onTick(() => {});
    };
  }, []);

  // Load favorites list on mount and library tab
  useEffect(() => {
    if (activeTab === 'library') {
      setFavoritesList(favoriteManager.getAll());
    }
  }, [activeTab]);

  // Parse breakdown when it changes
  useEffect(() => {
    if (breakdown) {
      const parsed = parseBreakdown(breakdown.response);
      setSteps(parsed.steps);
      setEstimatedTimes(parsed.estimatedTimes);
      console.log('[App] Steps after parse:', parsed.steps.length, 'Estimated:', parsed.estimatedTimes);
    }
  }, [breakdown]);

  const handleInitialize = async () => {
    if (initializing) return;

    setInitializing(true);
    setLoadProgress('Starting...');
    setInitialized(false);

    try {
      const result = await llmService.initialize();
      if (result.success) {
        setInitialized(true);
        setLoadProgress('');
      } else {
        setLoadProgress(result.message || 'Failed to initialize');
      }
    } catch (error) {
      console.error('Initialize error:', error);
      setLoadProgress('Error: ' + (error as Error).message);
    } finally {
      setInitializing(false);
    }
  };

  const handleBreakdown = async () => {
    if (!taskInput.trim()) return;

    if (!initialized) {
      alert('Please initialize the LLM first!');
      return;
    }

    setLoading(true);
    setBreakdown(null);
    setShowTimerUI(false);

    try {
      const result = await llmService.breakdownTask(taskInput);
      setBreakdown(result);
      setCacheStats(llmService.getCacheStats());

      const memory = await llmService.getMemoryUsage();
      setMemoryUsage(memory);
    } catch (error) {
      console.error('LLM Error:', error);
      setBreakdown({
        response: 'Error: Failed to generate breakdown.',
        fromCache: false,
        inferenceTime: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartTimer = () => {
    if (steps.length === 0) return;

    const timer = timerManager.startTask(
      taskInput,
      steps,
      estimatedTimes
    );

    setActiveTimer(timer);
    setShowTimerUI(true);
  };

  const handleToggleStep = (stepIndex: number) => {
    const updated = timerManager.toggleStep(stepIndex);
    if (updated) {
      setActiveTimer(updated);
    }
  };

  const handleCompleteStep = (stepIndex: number, isComplete: boolean) => {
    console.log(`[App] ◀ handleCompleteStep called: index=${stepIndex}, isComplete=${isComplete}`);
    console.log(`[App] ◀ Before update: step ${stepIndex}.isCompleted = ${activeTimer?.steps[stepIndex]?.isCompleted}`);

    const updated = isComplete
      ? timerManager.completeStep(stepIndex)
      : timerManager.uncompleteStep(stepIndex);

    console.log(`[App] ◀ Updated timer returned:`, updated ? `YES - steps=${updated.steps.length}, step[${stepIndex}].isCompleted=${updated.steps[stepIndex]?.isCompleted}` : 'NO');

    if (updated) {
      setActiveTimer(updated);
      console.log(`[App] ◀ setActiveTimer called with updated state`);
    }

    console.log(`[App] ◀ After setActiveTimer: activeTimer is ${activeTimer ? 'SET' : 'NULL'}`);
  };

  const handleCompleteTask = () => {
    console.log('[App] 🏁 Complete Task button clicked');

    const completed = timerManager.completeTask();
    console.log('[App] 🏁 Completed task returned:', completed ? 'YES' : 'NO');

    if (completed) {
      const completedSteps = completed.steps.filter((s: StepTimer) => s.isCompleted).length;
      const message = `Task completed in ${timerManager.formatTime(completed.totalElapsed)}!\n${completedSteps}/${completed.steps.length} steps done.`;

      alert(message);
      console.log('[App] 🏁 Alert shown:', message);

      // Close timer UI after completion
      setShowTimerUI(false);
      setActiveTimer(null);
      console.log('[App] 🏁 Timer UI closed');
    }
  };

  const handleSaveFavorite = () => {
    if (!breakdown) return;

    favoriteManager.save(
      taskInput,
      breakdown.response,
      estimatedTimes.reduce((sum, t) => sum + t, 0)
    );

    setFavoritesList(favoriteManager.getAll());
    alert('Saved to library!');
  };

  const handleSelectFavorite = (favorite: FavoriteBreakdown) => {
    setTaskInput(favorite.task);
    const parsed = parseBreakdown(favorite.response);

    setBreakdown({
      response: favorite.response,
      fromCache: true,
      inferenceTime: 0,
    });

    setSteps(parsed.steps);
    setEstimatedTimes(parsed.estimatedTimes);
    setShowTimerUI(false);

    // Update last used time
    favoriteManager.touch(favorite.id);
    setFavoritesList(favoriteManager.getAll());
    setActiveTab('home');
  };

  const handleDeleteFavorite = (id: string) => {
    if (confirm('Delete this saved breakdown?')) {
      favoriteManager.remove(id);
      setFavoritesList(favoriteManager.getAll());
    }
  };

  const handleClearCache = () => {
    const beforeCount = cacheStats.size;
    llmService.clearCache();
    const afterCount = llmService.getCacheStats().size;

    const cleared = beforeCount - afterCount;
    if (cleared > 0) {
      alert(`Cleared ${cleared} cached responses`);
      setCacheStats(llmService.getCacheStats());
    } else {
      alert('No cached responses to clear');
    }
  };

  const parseBreakdown = (response: string): { steps: string[]; estimatedTimes: number[] } => {
    const lines = response.split('\n').filter(line => line.trim());
    const steps: string[] = [];
    const times: number[] = [];

    console.log('[App] 🔍 Parsing breakdown with', lines.length, 'lines');

    lines.forEach((line, idx) => {
      console.log(`[App] 🔍 Parsing line ${idx}: "${line.trim()}"`);

      let match: RegExpMatchArray | null;

      // Priority 1: Numbered format "Step 1: Do something (5 min)"
      match = line.match(/^step\s*\d+:\s*([^()]+?)\s*\((\d+)\s*min\)/i);
      if (!match) {
        // Try alternative format "1. Do something (5 min)"
        match = line.match(/^\d+\.\s*([^()]+?)\s*\((\d+)\s*min\)/i);
      }

      if (match) {
        const stepText = match[1].trim();
        const timeText = parseInt(match[2], 10);

        if (stepText.toLowerCase().includes('clear action')) {
          console.log(`[App] Skipped numbered placeholder: "${stepText}"`);
          return;
        }

        steps.push(stepText);
        times.push(timeText);
        console.log(`[App] ✅ Matched numbered step: "${stepText}" (${timeText} min)`);
        return;
      }

      // Priority 2: Bracket format "- [Action] (X min)"
      match = line.match(/^-\s*\[([^\]]+)\]\s*\((\d+)\s*min\)/i);
      if (match) {
        const stepText = match[1].trim();
        const timeText = parseInt(match[2], 10);

        if (stepText.toLowerCase().includes('clear action')) {
          console.log(`[App] Skipped bracket placeholder: "${stepText}"`);
          return;
        }

        steps.push(stepText);
        times.push(timeText);
        console.log(`[App] ✅ Matched bracket step: "${stepText}" (${timeText} min)`);
        return;
      }

      // Priority 3: Bullet format "- Action (X min)"
      match = line.match(/^-\s+([^()]+?)\s*\((\d+)\s*min\)/i);
      if (match) {
        const stepText = match[1].trim();
        const timeText = parseInt(match[2], 10);

        if (stepText.toLowerCase().includes('clear action')) {
          console.log(`[App] Skipped bullet placeholder: "${stepText}"`);
          return;
        }

        steps.push(stepText);
        times.push(timeText);
        console.log(`[App] ✅ Matched bullet step: "${stepText}" (${timeText} min)`);
        return;
      }

      // Fallback: Any line with (X min) that's not indented
      match = line.match(/^[^\s].*?\((\d+)\s*min\)/i);
      if (match) {
        const timeText = parseInt(match[1], 10);
        const stepText = line.replace(/\s*\(\d+\s*min\)/i, '').trim();

        if (stepText && stepText.length > 3 && !stepText.toLowerCase().includes('clear action')) {
          steps.push(stepText);
          times.push(timeText);
          console.log(`[App] ✅ Fallback time extraction: "${stepText}" (${timeText} min)`);
          return;
        }
      }

      console.log(`[App] ⚠️ No match for line ${idx}`);
    });

    console.log(`[App] ✅ Total parsed: ${steps.length} steps`);
    console.log(`[App] Steps:`, steps);
    console.log(`[App] Times:`, times);

    if (steps.length === 0) {
      console.warn(`[App] ⚠️ NO STEPS PARSED - check LLM output format`);
    }

    return { steps, estimatedTimes: times };
  };

  const getProgressPercentage = (): number => {
    if (!activeTimer) return 0;
    const completed = activeTimer.steps.filter(s => s.isCompleted).length;
    return (completed / activeTimer.steps.length) * 100;
  };

  const filteredFavorites = favoritesList.filter(f =>
    !searchQuery || f.task.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Render Home Tab
  const renderHome = () => (
    <div className="tab-content">
      <div className="task-input-section">
        <textarea
          className="task-textarea"
          value={taskInput}
          onChange={(e) => setTaskInput(e.target.value)}
          placeholder={initialized ? "What task would you like to break down?" : "Initialize the model to get started..."}
          disabled={!initialized || loading}
          rows={3}
        />
      </div>

      <div className="actions-section">
        {!initialized && !initializing && (
          <button className="ios-button primary" onClick={handleInitialize}>
            Initialize Model
          </button>
        )}

        {initializing && (
          <div className="loading-container">
            <div className="spinner" />
            <p className="loading-text">
              {loadProgress || 'Downloading model (~900MB)...'}
            </p>
          </div>
        )}

        {(initialized || showTimerUI) && (
          <button
            className={`ios-button primary ${!taskInput.trim() || loading ? 'disabled' : ''}`}
            onClick={handleBreakdown}
            disabled={!taskInput.trim() || loading}>
            {loading ? <div className="spinner-small" /> : 'Break It Down'}
          </button>
        )}

        {showTimerUI && (
          <button className="ios-button danger" onClick={() => {
            timerManager.stopTask();
            setShowTimerUI(false);
            setActiveTimer(null);
          }}>
            Cancel Timer
          </button>
        )}
      </div>

      {breakdown && (
        <div className="breakdown-section">
          <div className="breakdown-header">
            <h2>Breakdown</h2>
            <button className="ios-icon-button" onClick={handleSaveFavorite}>
              ⭐ Save
            </button>
          </div>

          {!showTimerUI && (
            <div className="breakdown-stats">
              <span>⏱️ {breakdown.inferenceTime.toFixed(0)}ms</span>
              {breakdown.fromCache && <span className="cache-tag">💾 Cached</span>}
            </div>
          )}

          {showTimerUI && activeTimer && (
            <div className="timer-overview">
              <div className="timer-main-display">
                <div className="total-time">{timerManager.formatTime(activeTimer.totalElapsed)}</div>
                <div className="progress-info">
                  {activeTimer.steps.filter(s => s.isCompleted).length} / {activeTimer.steps.length} completed
                </div>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${getProgressPercentage()}%` }} />
              </div>
              <div className="timer-actions-row">
                <button className="ios-button success" onClick={handleCompleteTask}>
                  ✅ Complete
                </button>
              </div>
            </div>
          )}

          <div className="steps-list">
            {steps.map((step, index) => {
              const stepTimer = activeTimer?.steps[index];
              const isCompleted = stepTimer?.isCompleted;
              const isRunning = stepTimer?.isRunning;

              return (
                <div
                  key={index}
                  className={`step-card ${isCompleted ? 'completed' : ''} ${isRunning ? 'running' : ''}`}
                >
                  <div className="step-main">
                    <div className="step-left">
                      <input
                        type="checkbox"
                        className="step-checkbox"
                        checked={!!isCompleted}
                        onChange={(e) => handleCompleteStep(index, e.target.checked)}
                      />
                      <span className="step-number">{index + 1}</span>
                    </div>
                    <div className="step-right">
                      <p className="step-text">{step}</p>
                      <div className="step-footer">
                        <span className="step-time">⏱️ {estimatedTimes[index]} min</span>
                        {showTimerUI && stepTimer && (
                          <>
                            <span className="step-elapsed">{timerManager.formatTime(stepTimer.elapsedTime)}</span>
                            <button
                              className={`step-toggle ${isRunning ? 'active' : ''}`}
                              onClick={() => handleToggleStep(index)}>
                              {isRunning ? '⏸️' : '▶️'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {!showTimerUI && steps.length > 0 && (
            <button className="ios-button success full-width" onClick={handleStartTimer}>
              ▶️ Start Timer
            </button>
          )}
        </div>
      )}
    </div>
  );

  // Render Library Tab
  const renderLibrary = () => (
    <div className="tab-content">
      <div className="search-bar">
        <input
          className="search-input"
          type="text"
          placeholder="Search saved tasks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="favorites-list">
        {filteredFavorites.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">⭐</div>
            <p>No saved tasks yet</p>
            <p className="empty-subtext">Save your breakdowns for quick access</p>
          </div>
        ) : (
          filteredFavorites.map((favorite) => (
            <div key={favorite.id} className="favorite-card">
              <div className="favorite-content">
                <h3 className="favorite-title">{favorite.task}</h3>
                <p className="favorite-meta">
                  ⏱️ {favorite.totalEstimatedTime} min • Used {favorite.usageCount} times
                </p>
                <p className="favorite-date">
                  Saved {new Date(favorite.savedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="favorite-actions">
                <button
                  className="ios-button secondary"
                  onClick={() => handleSelectFavorite(favorite)}>
                  Use
                </button>
                <button
                  className="ios-icon-button danger"
                  onClick={() => handleDeleteFavorite(favorite.id)}>
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // Render Settings Tab
  const renderSettings = () => (
    <div className="tab-content">
      <div className="settings-group">
        <h3>Model Status</h3>
        <div className="setting-item">
          <span className="setting-label">Status</span>
          <span className="setting-value">{status}</span>
        </div>
        {memoryUsage && (
          <div className="setting-item">
            <span className="setting-label">Memory</span>
            <span className="setting-value">{memoryUsage}</span>
          </div>
        )}
        {cacheStats.size > 0 && (
          <div className="setting-item">
            <span className="setting-label">Cache</span>
            <span className="setting-value">{cacheStats.size} responses</span>
          </div>
        )}
      </div>

      <div className="settings-group">
        <h3>Model Info</h3>
        <div className="setting-item">
          <span className="setting-label">Model</span>
          <span className="setting-value">Qwen2-1.5B-Instruct</span>
        </div>
        <div className="setting-item">
          <span className="setting-label">Size</span>
          <span className="setting-value">~900MB</span>
        </div>
        <div className="setting-item">
          <span className="setting-label">Quantization</span>
          <span className="setting-value">Q4 (4-bit)</span>
        </div>
      </div>

      <div className="settings-group">
        <h3>Cache Management</h3>
        <div className="setting-item">
          <span className="setting-label">Cached Responses</span>
          <span className="setting-value">{cacheStats.size}</span>
        </div>
        <div className="setting-item">
          <span className="setting-label">Cache Size</span>
          <span className="setting-value">{(cacheStats.sizeBytes / 1024).toFixed(1)} KB</span>
        </div>
        <button className="ios-button danger" onClick={handleClearCache}>
          Clear Cache
        </button>
      </div>

      <div className="settings-group">
        <h3>About</h3>
        <div className="setting-item">
          <span className="setting-label">Version</span>
          <span className="setting-value">1.0.0</span>
        </div>
        <div className="setting-item">
          <span className="setting-label">Platform</span>
          <span className="setting-value">Native App</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="ios-app">
      <div className="ios-header">
        <h1>FocusMate AI</h1>
      </div>

      <div className="ios-content">
        {activeTab === 'home' && renderHome()}
        {activeTab === 'library' && renderLibrary()}
        {activeTab === 'settings' && renderSettings()}
      </div>

      <div className="ios-tab-bar">
        <button
          className={`tab-item ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}>
          <span className="tab-icon">🏠</span>
          <span className="tab-label">Home</span>
        </button>
        <button
          className={`tab-item ${activeTab === 'library' ? 'active' : ''}`}
          onClick={() => setActiveTab('library')}>
          <span className="tab-icon">📚</span>
          <span className="tab-label">Library</span>
        </button>
        <button
          className={`tab-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}>
          <span className="tab-icon">⚙️</span>
          <span className="tab-label">Settings</span>
        </button>
      </div>
    </div>
  );
}

export default App;
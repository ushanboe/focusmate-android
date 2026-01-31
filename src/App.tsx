import { useState, useEffect } from 'react';
import { llmService } from './llm/LLMService';
import { timerManager, type StepTimer, type TaskTimer } from './timer/TimerManager';
import { favoriteManager, type FavoriteBreakdown } from './favorites/FavoriteManager';
import './App.css';

function App() {
  const [taskInput, setTaskInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [breakdown, setBreakdown] = useState<{ response: string; fromCache: boolean; inferenceTime: number } | null>(null);
  const [memoryUsage, setMemoryUsage] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Not initialized');
  const [loadProgress, setLoadProgress] = useState<string>('');
  const [cacheStats, setCacheStats] = useState({ size: 0, sizeBytes: 0 });
  const [showCache, setShowCache] = useState(false);

  // Timer state
  const [activeTimer, setActiveTimer] = useState<TaskTimer | null>(null);
  const [showTimerUI, setShowTimerUI] = useState(false);

  // Favorites state
  const [showFavorites, setShowFavorites] = useState(false);
  const [favoritesList, setFavoritesList] = useState<FavoriteBreakdown[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

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
      // TimerManager doesn't have an unregister method, but we can clear the callback
      // by setting a no-op handler
      timerManager.onTick(() => {});
    };
  }, []);

  // Load favorites list
  useEffect(() => {
    setFavoritesList(favoriteManager.getAll());
  }, [showFavorites]);

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
    alert('Saved to favorites!');
  };

  const handleSelectFavorite = (favorite: FavoriteBreakdown) => {
    setTaskInput(favorite.task);
    const parsed = parseBreakdown(favorite.response);
    setSteps(parsed.steps);
    setEstimatedTimes(parsed.estimatedTimes);

    setBreakdown({
      response: favorite.response,
      fromCache: true,
      inferenceTime: 0,
    });

    setShowFavorites(false);
    setShowTimerUI(true);
  };

  const handleDeleteFavorite = (id: string) => {
    if (confirm('Delete this favorite?')) {
      favoriteManager.remove(id);
      setFavoritesList(favoriteManager.getAll());
    }
  };

  const handleClearCache = () => {
    llmService.clearCache();
    setCacheStats({ size: 0, sizeBytes: 0 });
    alert('Cache cleared!');
  };

  const parseBreakdown = (response: string): { steps: string[]; estimatedTimes: number[] } => {
    const lines = response.split('\n').filter(line => line.trim());
    const steps: string[] = [];
    const times: number[] = [];

    console.log('[App] Parsing breakdown:', response.substring(0, 200) + '...');
    console.log('[App] Total lines:', lines.length);

    lines.forEach((line, idx) => {
      console.log(`[App] Line ${idx}:`, line.substring(0, 80));

      // Skip sub-bullets (indented lines starting with * or -)
      if (line.match(/^\s+\*+/) || line.match(/^\s+-/) || line.match(/^\s+•/)) {
        console.log(`[App] Skipped sub-bullet/indented line`);
        return;
      }

      // Priority 1: Numbered format "1. Action (X min)" - this is the main step
      let match = line.match(/^\d+\.\s+([^()]+?)\s*\((\d+)\s*min\)/i);
      if (match) {
        const stepText = match[1].trim();
        const timeText = parseInt(match[2], 10);

        // Skip placeholder steps
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

        // Skip placeholder steps
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

        // Skip placeholder steps
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

  return (
    <div className="app-container">
      <div className="content">
        <h1 className="title">🧩 FocusMate AI</h1>
        <p className="subtitle">
          Local LLM Task Breakdown + Timer
          <span className="platform-badge">PWA Mode (Web-LLM)</span>
        </p>

        {/* Favorites Button */}
        <button
          className="icon-button"
          onClick={() => setShowFavorites(!showFavorites)}>
          ⭐ Favorites ({favoritesList.length})
        </button>

        {/* LLM Status */}
        <div className="status-container">
          <p className="status-text">
            Status: {status}
          </p>
          {loadProgress && (
            <p className="status-text progress-text">
              {loadProgress}
            </p>
          )}
          {cacheStats.size > 0 && (
            <p className="cache-stats">
              📦 {cacheStats.size} cached responses ({(cacheStats.sizeBytes / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        {/* Favorites Modal */}
        {showFavorites && (
          <div className="modal-overlay">
            <div className="modal">
              <h2 className="modal-title">⭐ Saved Breakdowns</h2>

              <div className="search-container">
                <input
                  className="search-input"
                  placeholder="Search favorites..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="favorites-list">
                {favoritesList.length === 0 ? (
                  <p className="empty-favorites">No saved breakdowns yet</p>
                ) : (
                  <div className="favorites-entries">
                    {favoritesList
                      .filter(f =>
                        !searchQuery || f.task.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((favorite) => (
                        <div key={favorite.id} className="favorite-item">
                          <div className="favorite-header">
                            <h3 className="favorite-task">{favorite.task}</h3>
                            <div className="favorite-actions">
                              <button
                                className="small-button primary-button"
                                onClick={() => handleSelectFavorite(favorite)}>
                                ▶️ Use
                              </button>
                              <button
                                className="small-button danger-button"
                                onClick={() => handleDeleteFavorite(favorite.id)}>
                                🗑️
                              </button>
                            </div>
                          </div>
                          <p className="favorite-time">
                            Saved {new Date(favorite.savedAt).toLocaleDateString()} • Used {favorite.usageCount} times
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <button
                className="close-modal-btn"
                onClick={() => setShowFavorites(false)}>
                Close
              </button>
            </div>
          </div>
        )}

        {/* Input Section */}
        {!showTimerUI && (
          <>
            <div className="input-container">
              <label htmlFor="taskInput" className="label">
                Enter a task:
              </label>
              <input
                id="taskInput"
                className="input"
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                placeholder={initialized ? "e.g., clean the kitchen" : "Initialize LLM first..."}
                onKeyDown={(e) => e.key === 'Enter' && handleBreakdown()}
                disabled={!initialized || loading}
              />
            </div>

            <>
              {!initialized && !initializing && (
                <button
                  className="button init-button"
                  onClick={handleInitialize}>
                  Initialize Web-LLM
                </button>
              )}

              {initializing && (
                <div className="loading-info">
                  <span className="spinner" />
                  <p className="loading-text">
                    Downloading model (~900MB) - first load takes 1-3 minutes...
                  </p>
                </div>
              )}

              {(initialized || showTimerUI) && (
                <button
                  className={`button ${(!taskInput.trim() || loading) && 'button-disabled'}`}
                  onClick={handleBreakdown}
                  disabled={!taskInput.trim() || loading}>
                  {loading ? (
                    <span className="spinner" />
                  ) : (
                    'Break it Down!'
                  )}
                </button>
              )}
            </>
          </>
        )}

        {/* Results with Timer */}
        {breakdown && (
          <div className="result-container">
            <div className="result-header">
              <h2 className="result-title">
                {showTimerUI ? 'Task Timer' : 'Breakdown:'}
              </h2>
              <>
                {!showTimerUI && (
                  <span className={`cache-badge ${breakdown.fromCache ? 'cache-hit' : 'cache-miss'}`}>
                    {breakdown.fromCache ? '💾 From Cache (< 1ms)' : '🔄 Fresh Generation'}
                  </span>
                )}
                {!showTimerUI && (
                  <button
                    className="icon-button"
                    onClick={handleSaveFavorite}
                    disabled={showTimerUI}>
                    ⭐ Save
                  </button>
                )}
              </>
            </div>

            {!showTimerUI && (
              <div className="stats">
                <span className="stat">
                  ⏱️ {breakdown.inferenceTime.toFixed(0)}ms
                </span>
                {memoryUsage && <span className="stat">💾 {memoryUsage}</span>}
              </div>
            )}

            {/* Timer UI */}
            {showTimerUI && activeTimer && (
              <>
                <div className="timer-header">
                  <h3 className="task-title">{activeTimer.task}</h3>
                  <div className="timers">
                    <span className="timer-display">
                      ⏱️ Total: {timerManager.formatTime(activeTimer.totalElapsed)}
                    </span>
                    <span className="timer-display">
                      🎯 Progress: {activeTimer.steps.filter(s => s.isCompleted).length}/{activeTimer.steps.length}
                    </span>
                  </div>
                </div>

                <div className="progress-bar-container">
                  <div
                    className="progress-bar"
                    style={{ width: `${getProgressPercentage()}%` }}
                  />
                </div>

                <div className="timer-actions">
                  <button
                    className="button complete-button"
                    onClick={handleCompleteTask}>
                    ✅ Complete Task
                  </button>
                  <button
                    className="button cancel-button"
                    onClick={() => {
                      timerManager.stopTask();
                      setShowTimerUI(false);
                      setActiveTimer(null);
                    }}>
                    ❌ Cancel
                  </button>
                </div>
              </>
            )}

            <div className="result">
              {showTimerUI && activeTimer ? (
                /* Timer Mode: Steps with checkboxes */
                <div className="timer-steps">
                  {activeTimer.steps.map((step, idx) => (
                    <div
                      key={`step-${idx}-${step.isCompleted}`}
                      className={`timer-step ${step.isCompleted ? 'step-completed' : ''} ${step.isRunning ? 'step-running' : ''}`}>
                      <div className="step-left">
                        <input
                          type="checkbox"
                          checked={step.isCompleted}
                          onChange={(e) => {
                            console.log(`[App] 🔄 Checkbox changed: idx=${idx}, checked=${e.target.checked}, current state=${step.isCompleted}`);
                            handleCompleteStep(idx, e.target.checked);
                          }}
                          className="step-checkbox"
                        />
                        <span className="step-number">{idx + 1}.</span>
                      </div>
                      <div className="step-main">
                        <p className="step-text">{step.step}</p>
                        <div className="step-timer-control">
                          <button
                            className={`timer-toggle ${step.isCompleted ? 'disabled' : ''}`}
                            onClick={() => !step.isCompleted && handleToggleStep(idx)}
                            disabled={step.isCompleted}>
                            {step.isRunning ? '⏸️ Pause' : '▶️ Start'}
                          </button>
                          <span className="step-time">
                            ⏱️ {timerManager.formatTime(step.elapsedTime)} / {step.estimatedTime} min
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* View Mode: Just show breakdown */
                <>
                  {steps.length > 0 ? (
                    <div className="breakdown-plain">
                      {steps.map((step, idx) => (
                        <div key={idx} className="breakdown-line">
                          {idx + 1}. {step} ({estimatedTimes[idx]} min)
                        </div>
                      ))}
                    </div>
                  ) : (
                    breakdown.response.split('\n').map((line, idx) => (
                      <div key={idx} className="breakdown-line">
                        {line}
                      </div>
                    ))
                  )}
                  {!showTimerUI && steps.length > 0 && (
                    <button
                      className="button start-timer-button"
                      onClick={handleStartTimer}>
                      ⏱️ Start Timer
                    </button>
                  )}

                  {/* Debug: Show if timer button should appear */}
                  {!showTimerUI && steps.length === 0 && (
                    <div className="debug-info">
                      <p style={{color: 'orange', fontSize: '12px'}}>
                        DEBUG: steps.length = 0, timer button hidden
                        <br/>Check console for parsing errors
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Cache Management */}
        {cacheStats.size > 0 && !initializing && !showTimerUI && (
          <div className="cache-container">
            <button
              className="small-button"
              onClick={() => setShowCache(!showCache)}>
              {showCache ? 'Hide Cache' : 'View Cache'} ({cacheStats.size})
            </button>
            <button
              className="small-button danger-button"
              onClick={handleClearCache}>
              Clear Cache
            </button>
          </div>
        )}

        {/* Cache Display */}
        {showCache && (
          <div className="cache-list">
            <h3 className="cache-list-title">Cached Tasks:</h3>
            <p className="cache-help">
              Cache automatically stores task → response pairs.
            </p>
          </div>
        )}

        <div className="info-container">
          <p className="info-text">
            💡 <strong>How it works:</strong> First request generates breakdown via local LLM (~4s).
            Subsequent same tasks are instant (&lt; 1ms) from cache. Save favorites for quick access.
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
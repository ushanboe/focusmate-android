/**
 * TimerManager - Timer management for task steps
 *
 * Handles per-step timers + total timer + completion tracking
 */

export interface StepTimer {
  step: string;
  estimatedTime: number; // in minutes
  elapsedTime: number; // in milliseconds
  isRunning: boolean;
  isCompleted: boolean;
}

export interface TaskTimer {
  task: string;
  steps: StepTimer[];
  totalElapsed: number; // in milliseconds
  totalEstimated: number; // in minutes
  startTime: number | null;
  isRunning: boolean;
  completedAt: number | null;
}

export class TimerManager {
  private currentTask: TaskTimer | null = null;
  private activeStepIndex: number = -1;
  private intervalId: number | null = null;
  private onTickCallback: ((timer: TaskTimer) => void) | null = null;

  /**
   * Start a new task timer
   */
  startTask(task: string, steps: string[], estimatedTime: number[]): TaskTimer {
    if (this.currentTask) {
      throw new Error('A task is already in progress. Call stopTask() first.');
    }

    const stepTimers: StepTimer[] = steps.map((step, idx) => ({
      step,
      estimatedTime: estimatedTime[idx] || 5,
      elapsedTime: 0,
      isRunning: false,
      isCompleted: false,
    }));

    this.currentTask = {
      task,
      steps: stepTimers,
      totalElapsed: 0,
      totalEstimated: steps.reduce((sum, _, idx) => sum + (estimatedTime[idx] || 5), 0),
      startTime: Date.now(),
      isRunning: true,
      completedAt: null,
    };

    this.startTicker();
    return this.currentTask;
  }

  /**
   * Start/stop step timer - returns updated timer state
   */
  toggleStep(stepIndex: number): TaskTimer | null {
    if (!this.currentTask) return null;

    const step = this.currentTask.steps[stepIndex];
    if (!step) return null;

    if (step.isRunning) {
      // Stop current step
      step.isRunning = false;
      if (this.activeStepIndex === stepIndex) {
        this.activeStepIndex = -1;
      }
    } else {
      // Start this step, stop any other running step
      this.currentTask.steps.forEach((s, idx) => {
        if (s.isRunning && idx !== stepIndex) {
          s.isRunning = false;
        }
      });

      step.isRunning = true;
      this.activeStepIndex = stepIndex;
    }

    // Return a deep copy to force React re-render
    return this.getCurrentTask();
  }

  /**
   * Mark step as completed - returns updated timer state
   */
  completeStep(stepIndex: number): TaskTimer | null {
    if (!this.currentTask) return null;

    const step = this.currentTask.steps[stepIndex];
    if (!step) return null;

    console.log(`[TimerManager] completeStep: index=${stepIndex}, step="${step.step}"`);

    // Stop the step if running - directly mutate without calling toggleStep
    // to avoid issues with deep copying in the middle of operation
    if (step.isRunning) {
      step.isRunning = false;
      if (this.activeStepIndex === stepIndex) {
        this.activeStepIndex = -1;
      }
    }

    step.isCompleted = true;
    console.log(`[TimerManager] Step marked as completed: isCompleted=${step.isCompleted}`);

    // Check if all steps are completed
    const allComplete = this.currentTask.steps.every(s => s.isCompleted);
    console.log(`[TimerManager] All steps completed: ${allComplete}`);
    if (allComplete) {
      this.completeTask();
    }

    // Return a deep copy to force React re-render
    return this.getCurrentTask();
  }

  /**
   * Unmark step as completed - returns updated timer state
   */
  uncompleteStep(stepIndex: number): TaskTimer | null {
    if (!this.currentTask) return null;

    const step = this.currentTask.steps[stepIndex];
    if (!step) return null;

    console.log(`[TimerManager] uncompleteStep: index=${stepIndex}, step="${step.step}"`);
    step.isCompleted = false;
    console.log(`[TimerManager] Step marked as not completed: isCompleted=${step.isCompleted}`);

    // Return a deep copy to force React re-render
    return this.getCurrentTask();
  }

  /**
   * Complete entire task - returns completed task state
   */
  completeTask(): TaskTimer | null {
    if (!this.currentTask) return null;

    this.stopTicker();
    this.currentTask.isRunning = false;
    this.currentTask.completedAt = Date.now();

    // Ensure all steps are marked as completed
    this.currentTask.steps.forEach(step => {
      step.isCompleted = true;
    });

    // Return a deep copy
    return JSON.parse(JSON.stringify(this.currentTask));
  }

  /**
   * Stop task timer
   */
  stopTask(): TaskTimer | null {
    if (!this.currentTask) return null;

    this.stopTicker();

    // Stop any running step
    this.currentTask.steps.forEach((s, idx) => {
      if (s.isRunning) {
        this.toggleStep(idx);
      }
    });

    this.currentTask.isRunning = false;
    const completedTask = this.currentTask;

    this.currentTask = null;
    this.activeStepIndex = -1;

    return completedTask;
  }

  /**
   * Get current timer state (returns a deep copy to trigger React re-renders)
   */
  getCurrentTask(): TaskTimer | null {
    if (!this.currentTask) return null;

    // Deep copy to ensure React detects changes
    return JSON.parse(JSON.stringify(this.currentTask));
  }

  /**
   * Get progress (0-1)
   */
  getProgress(): number {
    if (!this.currentTask) return 0;

    const completed = this.currentTask.steps.filter(s => s.isCompleted).length;
    return completed / this.currentTask.steps.length;
  }

  /**
   * Format milliseconds to human readable time
   */
  formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Set tick callback (called every second)
   */
  onTick(callback: (timer: TaskTimer) => void): void {
    this.onTickCallback = callback;
  }

  /**
   * Start the ticker
   */
  private startTicker(): void {
    if (this.intervalId) return;

    this.intervalId = window.setInterval(() => {
      if (!this.currentTask) {
        this.stopTicker();
        return;
      }

      // Update total elapsed
      if (this.currentTask.startTime) {
        // Time since start, minus time when timer was paused
        // For now, simplified: just add 1 second to total
        this.currentTask.totalElapsed += 1000;
      }

      // Update active step elapsed
      if (this.activeStepIndex >= 0) {
        const activeStep = this.currentTask.steps[this.activeStepIndex];
        if (activeStep && activeStep.isRunning) {
          activeStep.elapsedTime += 1000;
        }
      }

      // Call callback if set - pass a DEEP COPY so React detects changes
      if (this.onTickCallback) {
        const copy = JSON.parse(JSON.stringify(this.currentTask));
        this.onTickCallback(copy);
      }
    }, 1000);
  }

  /**
   * Stop the ticker
   */
  private stopTicker(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Reset manager
   */
  reset(): void {
    this.stopTask();
    this.onTickCallback = null;
  }
}

// Export singleton instance
export const timerManager = new TimerManager();
console.log('[TimerManager] Exported timerManager singleton');
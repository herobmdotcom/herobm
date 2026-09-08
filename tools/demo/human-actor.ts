import type { Page, Locator } from '@playwright/test';

export interface HumanMovementOptions {
  /** Target speed factor (default: 1.0) */
  speed?: number;
  /** Number of interpolation steps per 100px (default: 20) */
  stepsPer100Px?: number;
  /** Minimum movement duration in ms (default: 300) */
  minDurationMs?: number;
  /** Maximum movement duration in ms (default: 1200) */
  maxDurationMs?: number;
  /** Curvature deviation factor (0 = straight line, 0.3 = natural curve, default: 0.25) */
  curveFactor?: number;
  /** Whether to add slight wobble / jitter along the path (default: true) */
  wobble?: boolean;
}

export interface HumanTypeOptions {
  /** Base delay between keypresses in ms (default: 85) */
  baseDelayMs?: number;
  /** Delay variance in ms (default: 45) */
  varianceMs?: number;
  /** Pause duration after space / word breaks in ms (default: 180) */
  wordBreakPauseMs?: number;
  /** Pause duration after punctuation (. , -) in ms (default: 280) */
  punctuationPauseMs?: number;
  /** If true, clear existing input content before typing (default: true) */
  clear?: boolean;
  /** If true, click the input first (default: true) */
  clickFirst?: boolean;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * HumanActor wraps a Playwright Page and simulates natural human-like interactions:
 * - Visible overlay cursor with click ripple animations
 * - Cubic Bézier interpolated mouse trajectories with realistic easing and curvature
 * - Human typing cadences with variable character delays and micro-pauses
 * - Natural hesitation and reading pauses
 * - Smooth scroll physics
 */
export class HumanActor {
  readonly page: Page;
  currentMousePos: Point = { x: 400, y: 300 };
  private isCursorInjected = false;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Injects or ensures the visual cursor overlay and click ripple effect are active.
   */
  async injectVisualCursor(): Promise<void> {
    const ensureCursorScript = `
      (() => {
        window.__ensureDemoCursor = (x, y) => {
          let container = document.getElementById('__demo_human_cursor_container');
          if (!container || !container.isConnected) {
            if (container) container.remove();
            
            container = document.createElement('div');
            container.id = '__demo_human_cursor_container';
            container.style.cssText = 'position:fixed!important;top:0!important;left:0!important;width:100vw!important;height:100vh!important;pointer-events:none!important;z-index:2147483647!important;overflow:hidden!important;margin:0!important;padding:0!important;';

            // Luminous Spotlight / Halo Disk
            const halo = document.createElement('div');
            halo.id = '__demo_human_halo';
            halo.style.cssText = 'position:fixed!important;top:0!important;left:0!important;width:48px!important;height:48px!important;border-radius:50%!important;background:rgba(251,191,36,0.42)!important;border:2px solid rgba(245,158,11,0.85)!important;box-shadow:0 0 18px rgba(251,191,36,0.65),inset 0 0 10px rgba(251,191,36,0.3)!important;pointer-events:none!important;will-change:transform!important;margin-top:-24px!important;margin-left:-24px!important;';

            // High-contrast Cursor Pointer
            const cursor = document.createElement('div');
            cursor.id = '__demo_human_cursor';
            cursor.style.cssText = 'position:fixed!important;top:0!important;left:0!important;width:34px!important;height:34px!important;pointer-events:none!important;will-change:transform!important;z-index:2147483647!important;';
            cursor.innerHTML = \`
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.6)) drop-shadow(0 1px 2px rgba(0,0,0,0.4));">
                <path d="M0 0V22L6 16H16L0 0Z" fill="#0f172a" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
                <circle cx="2" cy="2" r="2.5" fill="#f59e0b" stroke="#ffffff" stroke-width="0.8"/>
              </svg>
            \`;

            // Expanding Ripple for clicks
            const ripple = document.createElement('div');
            ripple.id = '__demo_human_ripple';
            ripple.style.cssText = 'position:fixed!important;top:0!important;left:0!important;width:60px!important;height:60px!important;border-radius:50%!important;border:3px solid #f59e0b!important;background:rgba(251,191,36,0.45)!important;box-shadow:0 0 16px rgba(245,158,11,0.8)!important;pointer-events:none!important;opacity:0!important;transform:scale(0)!important;margin-top:-30px!important;margin-left:-30px!important;will-change:transform,opacity!important;';

            container.appendChild(halo);
            container.appendChild(ripple);
            container.appendChild(cursor);
            
            const target = document.body || document.documentElement;
            if (target) {
              target.appendChild(container);
            }
          }

          const cursor = document.getElementById('__demo_human_cursor');
          const halo = document.getElementById('__demo_human_halo');
          if (cursor && typeof x === 'number' && typeof y === 'number') {
            cursor.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
          }
          if (halo && typeof x === 'number' && typeof y === 'number') {
            halo.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
          }
        };

        window.__triggerDemoClick = (x, y) => {
          window.__ensureDemoCursor(x, y);
          const ripple = document.getElementById('__demo_human_ripple');
          const halo = document.getElementById('__demo_human_halo');
          if (!ripple) return;

          ripple.style.transition = 'none';
          ripple.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) scale(0.2)';
          ripple.style.opacity = '1';

          if (halo) {
            halo.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) scale(1.4)';
          }

          requestAnimationFrame(() => {
            ripple.style.transition = 'transform 0.4s cubic-bezier(0.1, 0.8, 0.25, 1), opacity 0.4s ease-out';
            ripple.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) scale(1.6)';
            ripple.style.opacity = '0';

            setTimeout(() => {
              if (halo) {
                halo.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) scale(1.0)';
              }
            }, 180);
          });
        };

        window.addEventListener('mousemove', (e) => {
          window.__ensureDemoCursor(e.clientX, e.clientY);
        }, { passive: true });

        window.addEventListener('mousedown', (e) => {
          window.__triggerDemoClick(e.clientX, e.clientY);
        }, { passive: true });
      })();
    `;

    await this.page.addInitScript(ensureCursorScript).catch(() => {});
    await this.page.evaluate(ensureCursorScript).catch(() => {});
    await this.updateVisualCursor(this.currentMousePos.x, this.currentMousePos.y);
  }

  /**
   * Updates the on-screen visual cursor position using GPU-composited translate3d.
   */
  private async updateVisualCursor(x: number, y: number): Promise<void> {
    await this.page.evaluate(
      ([cx, cy]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = window as any;
        if (win.__ensureDemoCursor) {
          win.__ensureDemoCursor(cx, cy);
        }
      },
      [x, y]
    ).catch(() => {});
  }

  /**
   * Triggers the visual click ripple animation.
   */
  private async triggerVisualClick(x: number, y: number): Promise<void> {
    await this.page.evaluate(
      ([cx, cy]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = window as any;
        if (win.__triggerDemoClick) {
          win.__triggerDemoClick(cx, cy);
        }
      },
      [x, y]
    ).catch(() => {});
  }

  /**
   * Moves mouse smoothly along a human-like cubic Bézier trajectory from current position to (targetX, targetY).
   */
  async moveMouseTo(
    targetX: number,
    targetY: number,
    options: HumanMovementOptions = {}
  ): Promise<void> {
    const {
      speed = 1.35,
      stepsPer100Px = 20,
      minDurationMs = 180,
      maxDurationMs = 850,
      curveFactor = 0.20,
      wobble = true,
    } = options;

    const startX = this.currentMousePos.x;
    const startY = this.currentMousePos.y;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance = Math.hypot(dx, dy);

    if (distance < 5) {
      this.currentMousePos = { x: targetX, y: targetY };
      await this.page.mouse.move(targetX, targetY);
      await this.updateVisualCursor(targetX, targetY);
      return;
    }

    // Number of intermediate steps
    const rawSteps = Math.round((distance / 100) * stepsPer100Px * (1 / speed));
    const steps = Math.max(12, Math.min(60, rawSteps));

    // Calculate duration (roughly 30% faster)
    const rawDuration = (distance * 1.05 + 140) * (1 / speed);
    const durationMs = Math.max(minDurationMs, Math.min(maxDurationMs, rawDuration));
    const stepDelay = durationMs / steps;

    // Cubic Bézier control points
    // Perpendicular vector for natural arc deviation
    const perpX = -dy / distance;
    const perpY = dx / distance;
    const arcSide = Math.random() > 0.5 ? 1 : -1;
    const curveOffset = distance * curveFactor * arcSide * (0.7 + Math.random() * 0.6);

    // Control point 1 (near start, arcing away)
    const cp1x = startX + dx * 0.25 + perpX * curveOffset;
    const cp1y = startY + dy * 0.25 + perpY * curveOffset;

    // Control point 2 (near destination, pulling in with subtle overshoot)
    const cp2x = startX + dx * 0.75 + perpX * (curveOffset * 0.4);
    const cp2y = startY + dy * 0.75 + perpY * (curveOffset * 0.4);

    // Ease-in-out calculation (smooth S-curve acceleration / deceleration)
    const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

    for (let i = 1; i <= steps; i++) {
      const linearT = i / steps;
      const t = easeInOut(linearT);

      // Cubic Bézier formula: B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
      const u = 1 - t;
      let x = u * u * u * startX + 3 * u * u * t * cp1x + 3 * u * t * t * cp2x + t * t * t * targetX;
      let y = u * u * u * startY + 3 * u * u * t * cp1y + 3 * u * t * t * cp2y + t * t * t * targetY;

      // Subtle wobble / tremor
      if (wobble && i > 2 && i < steps - 2) {
        const wobbleFactor = Math.sin(linearT * Math.PI) * (1 - linearT);
        x += (Math.random() - 0.5) * 1.8 * wobbleFactor;
        y += (Math.random() - 0.5) * 1.8 * wobbleFactor;
      }

      await this.page.mouse.move(x, y);
      await this.updateVisualCursor(x, y);
      await this.delay(stepDelay);
    }

    // Final exact snap
    this.currentMousePos = { x: targetX, y: targetY };
    await this.page.mouse.move(targetX, targetY);
    await this.updateVisualCursor(targetX, targetY);
  }

  /**
   * Resolves a natural target point inside an element's bounding box (not dead center).
   */
  async getElementNaturalPoint(locatorOrSelector: string | Locator): Promise<Point> {
    const locator = typeof locatorOrSelector === 'string' ? this.page.locator(locatorOrSelector).first() : locatorOrSelector;
    await locator.waitFor({ state: 'visible', timeout: 15000 });
    const box = await locator.boundingBox();
    if (!box) {
      throw new Error(`Could not find bounding box for element: ${locatorOrSelector}`);
    }

    // Pick a point within inner 60% of the box with slight random jitter
    const innerMarginX = box.width * 0.2;
    const innerMarginY = box.height * 0.2;
    const targetX = box.x + innerMarginX + Math.random() * (box.width - innerMarginX * 2);
    const targetY = box.y + innerMarginY + Math.random() * (box.height - innerMarginY * 2);

    return { x: Math.round(targetX), y: Math.round(targetY) };
  }

  /**
   * Glides mouse over to an element smoothly.
   */
  async hover(
    locatorOrSelector: string | Locator,
    movementOptions?: HumanMovementOptions
  ): Promise<Point> {
    const point = await this.getElementNaturalPoint(locatorOrSelector);
    await this.moveMouseTo(point.x, point.y, movementOptions);
    return point;
  }

  /**
   * Simulates a natural human click:
   * 1. Glides mouse smoothly to target
   * 2. Hesitates / hovers briefly (perceptual delay)
   * 3. Press down with visual ripple
   * 4. Natural click duration (80-120ms)
   * 5. Releases mouse button
   * 6. Brief post-click pause
   */
  async click(
    locatorOrSelector: string | Locator,
    options: {
      movement?: HumanMovementOptions;
      preClickHesitationMs?: number;
      postClickPauseMs?: number;
    } = {}
  ): Promise<void> {
    const point = await this.hover(locatorOrSelector, options.movement);
    
    // Perceptual hesitation before clicking (120-250ms)
    const preHesitation = options.preClickHesitationMs ?? (120 + Math.random() * 140);
    await this.delay(preHesitation);

    // Trigger visual ripple and click
    await this.triggerVisualClick(point.x, point.y);
    await this.page.mouse.down();
    
    // Human click hold duration
    const holdMs = 70 + Math.random() * 50;
    await this.delay(holdMs);
    await this.page.mouse.up();

    // Post click pause
    const postPause = options.postClickPauseMs ?? (100 + Math.random() * 150);
    await this.delay(postPause);
  }

  /**
   * Simulates realistic human typing into an input field:
   * - Hovers and clicks into the input
   * - Clears existing text naturally if specified
   * - Types character-by-character with variable latency and word pauses
   */
  async type(
    locatorOrSelector: string | Locator,
    text: string,
    options: HumanTypeOptions = {}
  ): Promise<void> {
    const {
      baseDelayMs = 42,
      varianceMs = 18,
      wordBreakPauseMs = 85,
      punctuationPauseMs = 130,
      clear = true,
      clickFirst = true,
    } = options;

    const locator = typeof locatorOrSelector === 'string' ? this.page.locator(locatorOrSelector).first() : locatorOrSelector;

    // HTML5 date inputs in Chromium use internal locale-dependent segments (dd/mm/yyyy or mm/dd/yyyy)
    // and reject raw character typing or '-' dashes, scrambling the date. Use fill() instead.
    const inputType = await locator.getAttribute('type').catch(() => null);
    if (inputType === 'date') {
      if (clickFirst) {
        await this.click(locator);
      }
      await locator.fill(text);
      await locator.dispatchEvent('input');
      await locator.dispatchEvent('change');
      await this.delay(150 + Math.random() * 120);
      return;
    }

    if (clickFirst) {
      await this.click(locator);
    }

    if (clear) {
      // Select all and delete
      await this.page.keyboard.press('ControlOrMeta+A');
      await this.delay(80 + Math.random() * 60);
      await this.page.keyboard.press('Backspace');
      await this.delay(100 + Math.random() * 80);
    }

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      await this.page.keyboard.type(char);

      // Calculate variable delay for next keystroke
      let delayMs = baseDelayMs + (Math.random() - 0.5) * varianceMs * 2;
      
      if (char === ' ') {
        delayMs += wordBreakPauseMs * (0.7 + Math.random() * 0.6);
      } else if (char === '.' || char === ',' || char === '-' || char === ':' || char === '/') {
        delayMs += punctuationPauseMs * (0.8 + Math.random() * 0.5);
      } else if (char >= 'A' && char <= 'Z') {
        // Shift key combination pause
        delayMs += 50 + Math.random() * 40;
      }

      // 2% chance of a micro-glance pause (simulate looking back at reference)
      if (Math.random() < 0.02 && i > 3 && i < text.length - 2) {
        delayMs += 250 + Math.random() * 200;
      }

      await this.delay(Math.max(30, delayMs));
    }

    // Brief verification pause after finishing typing
    await this.delay(150 + Math.random() * 120);
  }

  /**
   * Smoothly scrolls the page up or down using simulated wheel steps.
   */
  async smoothScroll(deltaY: number, durationMs = 500): Promise<void> {
    const steps = 18;
    const stepDelay = durationMs / steps;
    const stepDelta = deltaY / steps;

    for (let i = 1; i <= steps; i++) {
      const progress = i / steps;
      // Easing curve for scroll velocity
      const easeFactor = Math.sin(progress * Math.PI);
      const dy = stepDelta * (0.6 + easeFactor * 0.8);
      await this.page.mouse.wheel(0, dy);
      await this.delay(stepDelay);
    }

    await this.delay(150);
  }

  /**
   * Pauses execution for a fixed duration.
   */
  async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Simulates a natural human hesitation or reading pause.
   */
  async pause(minMs = 400, maxMs = 900): Promise<void> {
    const ms = minMs + Math.random() * (maxMs - minMs);
    await this.delay(ms);
  }

  /**
   * Simulates a natural human drag and drop:
   * 1. Hovers over the source element with a generous reading pause
   * 2. Triggers visual mousedown animation
   * 3. Drags the visual cursor along a smooth curved path to the target
   * 4. Pauses briefly over the target column
   * 5. Dispatches standard HTML5 drag & drop events to trigger React onDrop
   * 6. Releases mouse at destination with natural settling pause
   */
  async dragAndDrop(
    sourceLocatorOrSelector: string | Locator,
    targetLocatorOrSelector: string | Locator,
    options: {
      speed?: number;
      preDragPauseMs?: number;
      dragDurationMs?: number;
      holdOverTargetMs?: number;
      postDropPauseMs?: number;
      targetStage?: string;
    } = {}
  ): Promise<void> {
    const sourceLocator =
      typeof sourceLocatorOrSelector === 'string'
        ? this.page.locator(sourceLocatorOrSelector).first()
        : sourceLocatorOrSelector;
    const targetLocator =
      typeof targetLocatorOrSelector === 'string'
        ? this.page.locator(targetLocatorOrSelector).first()
        : targetLocatorOrSelector;

    // 1. Deliberate hover on source card
    const startPoint = await this.hover(sourceLocator);
    await this.delay(options.preDragPauseMs ?? 1600);

    // 2. Get destination drop point inside target column
    const endPoint = await this.getElementNaturalPoint(targetLocator);

    // 3. Trigger visual ripple animation
    await this.triggerVisualClick(startPoint.x, startPoint.y);
    await this.delay(150);

    // 4. Smooth glide across the board from source to destination
    const dragDuration = options.dragDurationMs ?? 1200;
    const steps = 35;
    const stepDelay = dragDuration / steps;
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;

    const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

    for (let i = 1; i <= steps; i++) {
      const t = easeInOut(i / steps);
      // Slight upward arc while dragging
      const arc = Math.sin(t * Math.PI) * -16;
      const x = Math.round(startPoint.x + dx * t);
      const y = Math.round(startPoint.y + dy * t + arc);

      await this.page.mouse.move(x, y);
      await this.updateVisualCursor(x, y);
      await this.delay(stepDelay);
    }

    // 5. Hover over the target drop column
    await this.delay(options.holdOverTargetMs ?? 600);
    await this.triggerVisualClick(endPoint.x, endPoint.y);

    // 6. Execute HTML5 drag and drop via Playwright and DOM events
    // Extract opportunity ID directly from source element
    const oppId = await sourceLocator.evaluate((el: HTMLElement) => {
      return (
        el.getAttribute('data-opportunity-id') ||
        el.querySelector('a[href*="/crm/opportunities/"]')?.getAttribute('href')?.split('/').pop() ||
        ''
      );
    }).catch(() => '');

    if (oppId) {
      await targetLocator.evaluate(
        (targetEl: HTMLElement, payload: { oppId: string; targetStage?: string }) => {
          const dt = new DataTransfer();
          dt.setData('text/plain', payload.oppId);

          const stageCol = payload.targetStage
            ? document.querySelector(`[data-stage="${payload.targetStage}"]`) || targetEl
            : targetEl;

          stageCol.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }));
          stageCol.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
          stageCol.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
        },
        { oppId, targetStage: options.targetStage }
      ).catch(() => {});
    }

    // Also call Playwright's dragTo to ensure full event lifecycle
    await sourceLocator.dragTo(targetLocator).catch(() => {});

    // 7. Settle visual cursor at drop destination
    await this.updateVisualCursor(endPoint.x, endPoint.y);
    await this.delay(options.postDropPauseMs ?? 2500);
  }

  /**
   * Glides the cursor to an area to simulate the user looking or inspecting it.
   */
  async lookAt(locatorOrSelector: string | Locator, readTimeMs = 800): Promise<void> {
    await this.hover(locatorOrSelector);
    await this.delay(readTimeMs);
  }
}

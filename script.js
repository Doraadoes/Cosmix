/**
 * ==========================================================================
 * COSMIX — CORE ENGINE
 * Phase 1 Architecture: Routing, Living Starfield, Synthesizer, Auth & Splash Loading
 * ==========================================================================
 */

import {
  fetchNASA_APOD,
  fetchISS_Location,
  fetchAstronautsInSpace,
  fetchSpaceXLaunches,
  fetchUpcomingRocketLaunches,
  fetchMarsRoverPhotos,
  fetchEarthLiveEPIC,
  fetchSolarSystemPlanets,
  getNasaApiKey
} from './api/spaceApi.js';
import { getUser, loginUser, registerUser, logoutUser, isSupabaseConfigured } from './auth.js';


// Global State
const state = {
  activePage: 'dashboard',
  theme: localStorage.getItem('astro-theme') || 'dark',
  soundEnabled: localStorage.getItem('astro-sound') === 'true',
  stars: [],
  shootingStars: [],
  splashComplete: false,
  
  // Phase 3 Extended State
  issMap: null,
  issMarker: null,
  issIntervalId: null,
  earthIndex: 0,
  earthPhotos: [],
  activeCountdownIntervals: []
};

// SVG icons matching pages for title badge updates
const pageIcons = {
  dashboard: 'fa-gauge-high',
  iss: 'fa-satellite',
  launches: 'fa-rocket',
  planets: 'fa-globe',
  mars: 'fa-robot',
  earth: 'fa-earth-americas',
  apod: 'fa-image',
  events: 'fa-star-and-crescent',
  settings: 'fa-sliders'
};

// Colorful style pairings for page badge icons
const pageColors = {
  dashboard: '#7b61ff',
  iss: '#00f5ff',
  launches: '#ff5d73',
  planets: '#ffd166',
  mars: '#ff5d73',
  earth: '#06b6d4',
  apod: '#8b5cf6',
  events: '#f59e0b',
  settings: '#38bdf8'
};

/* ==========================================================================
   1. RETRO-FUTURISTIC SYNTHESIZER (WEB AUDIO API)
   ========================================================================== */
function playSynthSound(type = 'click') {
  if (!state.soundEnabled) return;
  
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    const audioCtx = new AudioContext();
    
    if (type === 'click') {
      // Soft modern UI micro-beep
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.08);
      
      gainNode.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.08);
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'success') {
      // Ascending chime for system initialization
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc1.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
      osc1.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
      osc1.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.3); // C6
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1046.50, audioCtx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(1567.98, audioCtx.currentTime + 0.4);
      
      gainNode.gain.setValueAtTime(0.03, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.45);
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc1.start();
      osc2.start();
      osc1.stop(audioCtx.currentTime + 0.45);
      osc2.stop(audioCtx.currentTime + 0.45);
    } else if (type === 'theme') {
      // Whirring sci-fi frequency sweep
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.35);
      
      gainNode.gain.setValueAtTime(0.02, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    }
  } catch (err) {
    console.warn('Audio feedback synthesis blocked or unsupported:', err);
  }
}

/* ==========================================================================
   2. TOAST NOTIFICATION SYSTEM
   ========================================================================== */
function showToast(message, type = 'info') {
  const portal = document.getElementById('toast-portal');
  if (!portal) return;

  const toast = document.createElement('div');
  toast.className = `toast glass-panel`;
  
  // Set indicator color based on type
  let color = 'var(--primary-1)';
  let icon = 'fa-circle-info';
  
  if (type === 'success') {
    color = 'var(--success)';
    icon = 'fa-circle-check';
  } else if (type === 'warning') {
    color = 'var(--accent-2)';
    icon = 'fa-triangle-exclamation';
  } else if (type === 'error') {
    color = 'var(--danger)';
    icon = 'fa-circle-exclamation';
  }
  
  toast.style.borderLeft = `4px solid ${color}`;
  
  toast.innerHTML = `
    <i class="fa-solid ${icon}" style="color: ${color}"></i>
    <span style="font-weight: 500;">${message}</span>
  `;

  portal.appendChild(toast);

  // Remove toast automatically after 3.5s
  setTimeout(() => {
    toast.style.animation = 'toastSlideIn 0.3s reverse forwards cubic-bezier(0.16, 1, 0.3, 1)';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3500);
}

/* ==========================================================================
   3. HIGH PERFORMANCE TWINKLING CANVAS STARFIELD
   ========================================================================== */
function initStarfield() {
  const canvas = document.getElementById('space-canvas');
  if (!canvas) return;

  const resizeCanvas = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  const numStars = Math.min(200, Math.floor((window.innerWidth * window.innerHeight) / 7000));
  state.stars = [];

  for (let i = 0; i < numStars; i++) {
    state.stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 1.5 + 0.2,
      opacity: Math.random(),
      speed: Math.random() * 0.01 + 0.003,
      twinkleSpeed: Math.random() * 0.02 + 0.005,
      twinkleDir: Math.random() > 0.5 ? 1 : -1,
      color: Math.random() > 0.8 ? '#00f5ff' : (Math.random() > 0.8 ? '#ffd166' : '#ffffff')
    });
  }

  // Handle mouse parallax offset
  let mouseX = 0;
  let mouseY = 0;
  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX - window.innerWidth / 2) * 0.03;
    mouseY = (e.clientY - window.innerHeight / 2) * 0.03;
  });

  // Shoot a star occasionally
  const triggerShootingStar = () => {
    if (state.shootingStars.length < 2 && Math.random() > 0.98) {
      state.shootingStars.push({
        x: Math.random() * canvas.width * 0.6,
        y: Math.random() * canvas.height * 0.4,
        length: Math.random() * 80 + 40,
        speed: Math.random() * 12 + 8,
        angle: Math.random() * 20 + 25, // downward diagonal slant
        opacity: 1
      });
    }
  };

  const drawStars = () => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw static/twinkling stars
    state.stars.forEach(star => {
      // Twinkle logic
      star.opacity += star.twinkleSpeed * star.twinkleDir;
      if (star.opacity >= 1) {
        star.opacity = 1;
        star.twinkleDir = -1;
      } else if (star.opacity <= 0.1) {
        star.opacity = 0.1;
        star.twinkleDir = 1;
      }

      // Drift physics (orbital simulation)
      star.x += star.speed;
      if (star.x > canvas.width) star.x = 0;

      // Apply subtle parallax hover
      const renderX = star.x + (star.radius * mouseX * 0.2);
      const renderY = star.y + (star.radius * mouseY * 0.2);

      ctx.beginPath();
      ctx.arc(renderX, renderY, star.radius, 0, Math.PI * 2);
      ctx.fillStyle = star.color;
      ctx.globalAlpha = star.opacity;
      ctx.fill();
    });

    // Draw shooting stars
    triggerShootingStar();
    state.shootingStars.forEach((sStar, index) => {
      const angleRad = sStar.angle * Math.PI / 180;
      const endX = sStar.x + sStar.length * Math.cos(angleRad);
      const endY = sStar.y + sStar.length * Math.sin(angleRad);

      const grad = ctx.createLinearGradient(sStar.x, sStar.y, endX, endY);
      grad.addColorStop(0, `rgba(255, 255, 255, ${sStar.opacity})`);
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.beginPath();
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.moveTo(sStar.x, sStar.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Move shooting star
      sStar.x += sStar.speed * Math.cos(angleRad);
      sStar.y += sStar.speed * Math.sin(angleRad);
      sStar.opacity -= 0.035;

      if (sStar.opacity <= 0 || sStar.x > canvas.width || sStar.y > canvas.height) {
        state.shootingStars.splice(index, 1);
      }
    });

    ctx.globalAlpha = 1.0;
    requestAnimationFrame(drawStars);
  };

  requestAnimationFrame(drawStars);
}

/* ==========================================================================
   4. MISSION CONTROL INITIALIZATION SYSTEM (SPLASH SCREEN)
   ========================================================================== */
function runSplashScreen() {
  const loader = document.getElementById('splash-loader');
  const progressFill = document.getElementById('loader-progress-fill');
  const statusText = document.querySelector('.loader-status');
  if (!loader || !progressFill) return;

  const steps = [
    { progress: 15, text: 'Synchronizing Master clock feeds...' },
    { progress: 40, text: 'Mapping star chart grids...' },
    { progress: 65, text: 'Initializing neural orbit vectors...' },
    { progress: 85, text: 'Calibrating glassmorphic telemetry rails...' },
    { progress: 100, text: 'Systems operational. Opening display...' }
  ];

  let currentProgress = 0;
  let stepIndex = 0;

  const interval = setInterval(() => {
    if (currentProgress < 100) {
      currentProgress += Math.floor(Math.random() * 4) + 1;
      if (currentProgress > 100) currentProgress = 100;

      // Update progress fill
      progressFill.style.width = `${currentProgress}%`;

      // Trigger status text steps
      if (stepIndex < steps.length && currentProgress >= steps[stepIndex].progress) {
        statusText.textContent = steps[stepIndex].text;
        stepIndex++;
      }
    } else {
      clearInterval(interval);
      state.splashComplete = true;

      // Finish loading, transition out using GSAP
      if (typeof gsap !== 'undefined') {
        gsap.to(loader, {
          opacity: 0,
          duration: 0.8,
          ease: 'power2.out',
          onComplete: () => {
            loader.style.display = 'none';
            playSynthSound('success');
            showToast('COSMIX SYSTEMS ONLINE', 'success');
            animateSidebarEntrance();
          }
        });
      } else {
        // Fallback if GSAP is not yet ready or loaded
        loader.classList.add('hidden');
        setTimeout(() => {
          loader.style.display = 'none';
          playSynthSound('success');
          showToast('COSMIX SYSTEMS ONLINE', 'success');
        }, 800);
      }
    }
  }, 40);
}

// Side-entrance animation on first load
function animateSidebarEntrance() {
  if (typeof gsap !== 'undefined') {
    const sidebar = document.getElementById('app-sidebar');
    const header = document.querySelector('.header');
    const content = document.getElementById('app-content-body');
    const footer = document.querySelector('.footer');

    // Reset initial states
    gsap.set(sidebar, { x: -80, opacity: 0 });
    gsap.set(header, { y: -30, opacity: 0 });
    gsap.set(content, { opacity: 0, y: 15 });
    gsap.set(footer, { opacity: 0 });

    // Timeline trigger
    const tl = gsap.timeline();
    tl.to(sidebar, { x: 0, opacity: 1, duration: 1.0, ease: 'power4.out' })
      .to(header, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }, '-=0.6')
      .to(content, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, '-=0.5')
      .to(footer, { opacity: 1, duration: 0.6 }, '-=0.3');
  }
}

/* ==========================================================================
   5. REAL-TIME STELLAR & MISSION CLOCK
   ========================================================================== */
function initSystemClock() {
  const timeEl = document.getElementById('system-time');
  const dateEl = document.getElementById('system-date');
  if (!timeEl || !dateEl) return;

  const updateClock = () => {
    const now = new Date();
    
    // Format UTC Time
    const hrs = String(now.getUTCHours()).padStart(2, '0');
    const mins = String(now.getUTCMinutes()).padStart(2, '0');
    const secs = String(now.getUTCSeconds()).padStart(2, '0');
    timeEl.textContent = `${hrs}:${mins}:${secs} UTC`;

    // Format Planetary Calendar
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    
    const dayName = days[now.getUTCDay()];
    const monthName = months[now.getUTCMonth()];
    const dateNum = String(now.getUTCDate()).padStart(2, '0');
    const year = now.getUTCFullYear();
    
    // Add mission star date style
    const starDate = ((year - 2000) * 1000 + Math.floor((now.getUTCMonth() * 30 + now.getUTCDate()) * 2.7)).toFixed(1);

    dateEl.textContent = `${dayName} • ${dateNum} ${monthName} ${year} • SD ${starDate}`;
  };

  updateClock();
  setInterval(updateClock, 1000);
}

/* ==========================================================================
   6. STATEFUL ROUTER & TRANSITIONS
   ========================================================================== */
function navigateToPage(pageId) {
  if (state.activePage === pageId) return;

  // Track previous page for transition planning
  const prevPageId = state.activePage;
  state.activePage = pageId;

  // Sound effect
  playSynthSound('click');

  // 1. Update Active Navigation States (Desktop & Mobile)
  const navLinks = document.querySelectorAll('.sidebar-item-link, .mobile-nav-item');
  navLinks.forEach(link => {
    if (link.getAttribute('data-page') === pageId) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // 2. Animate Views Transitions
  const prevView = document.getElementById(`view-${prevPageId}`);
  const nextView = document.getElementById(`view-${pageId}`);

  if (nextView) {
    if (typeof gsap !== 'undefined' && prevView) {
      // Sleek cross-fade slide animation using GSAP
      const tl = gsap.timeline();
      
      tl.to(prevView, {
        opacity: 0,
        y: -10,
        duration: 0.25,
        ease: 'power2.in',
        onComplete: () => {
          prevView.classList.remove('active');
          nextView.classList.add('active');
          gsap.set(nextView, { opacity: 0, y: 15 });
        }
      });
      
      tl.to(nextView, {
        opacity: 1,
        y: 0,
        duration: 0.45,
        ease: 'power3.out',
        onComplete: () => {
          if (pageId === 'iss' && state.issMap) {
            state.issMap.invalidateSize();
          }
        }
      });
    } else {
      // Standard CSS Fallback
      if (prevView) prevView.classList.remove('active');
      nextView.classList.add('active');
      if (pageId === 'iss' && state.issMap) {
        state.issMap.invalidateSize();
      }
    }
  }

  // 3. Update Header Page Badges & Title
  const headerIcon = document.getElementById('header-page-icon');
  const headerTitle = document.getElementById('header-page-title');

  if (headerIcon && headerTitle) {
    // Animate badge change
    if (typeof gsap !== 'undefined') {
      gsap.to([headerIcon, headerTitle], {
        opacity: 0,
        x: -10,
        duration: 0.15,
        onComplete: () => {
          // Change text and icon class
          headerTitle.textContent = pageId.toUpperCase();
          headerIcon.className = `fa-solid ${pageIcons[pageId] || 'fa-globe'}`;
          headerIcon.style.color = pageColors[pageId] || 'var(--primary-1)';
          
          gsap.to([headerIcon, headerTitle], {
            opacity: 1,
            x: 0,
            duration: 0.25,
            ease: 'power2.out'
          });
        }
      });
    } else {
      headerTitle.textContent = pageId.toUpperCase();
      headerIcon.className = `fa-solid ${pageIcons[pageId] || 'fa-globe'}`;
      headerIcon.style.color = pageColors[pageId] || 'var(--primary-1)';
    }
  }

  // Close mobile sidebar menu if open after selection
  const sidebar = document.getElementById('app-sidebar');
  if (sidebar && sidebar.classList.contains('mobile-open')) {
    sidebar.classList.remove('mobile-open');
  }

  // Trigger Phase 3 live views loading
  if (typeof triggerPageLoad === 'function') {
    triggerPageLoad(pageId);
  }

  showToast(`TRANSIT: SECTOR ${pageId.toUpperCase()}`);
}

/* ==========================================================================
   PHASE 2: DASHBOARD WIDGETS & VISUALIZATION CONTROLLERS
   ========================================================================== */

// Launch countdown driver
function initLaunchCountdown() {
  const targetLaunchDate = Date.now() + (2 * 24 * 3600 + 14 * 3600 + 45 * 60 + 12) * 1000;

  function update() {
    const timeLeft = targetLaunchDate - Date.now();
    if (timeLeft <= 0) {
      const dEl = document.getElementById('dash-timer-days');
      const hEl = document.getElementById('dash-timer-hours');
      const mEl = document.getElementById('dash-timer-mins');
      const sEl = document.getElementById('dash-timer-secs');
      if (dEl) dEl.textContent = "00";
      if (hEl) hEl.textContent = "00";
      if (mEl) mEl.textContent = "00";
      if (sEl) sEl.textContent = "00";
      return;
    }

    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    const dEl = document.getElementById('dash-timer-days');
    const hEl = document.getElementById('dash-timer-hours');
    const mEl = document.getElementById('dash-timer-mins');
    const sEl = document.getElementById('dash-timer-secs');

    if (dEl) dEl.textContent = String(days).padStart(2, '0');
    if (hEl) hEl.textContent = String(hours).padStart(2, '0');
    if (mEl) mEl.textContent = String(minutes).padStart(2, '0');
    if (sEl) sEl.textContent = String(seconds).padStart(2, '0');
  }

  update();
  setInterval(update, 1000);
}

// ChartJS controllers
function initDashboardCharts() {
  const launchCtx = document.getElementById('chart-launch-frequency');
  const missionCtx = document.getElementById('chart-mission-share');
  if (!launchCtx || !missionCtx) return;

  const isLight = state.theme === 'light';
  const gridColor = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';
  const textColor = isLight ? '#475569' : '#9ca3af';

  const gradient = launchCtx.getContext('2d').createLinearGradient(0, 0, 0, 240);
  gradient.addColorStop(0, 'rgba(123, 97, 255, 0.35)');
  gradient.addColorStop(1, 'rgba(123, 97, 255, 0)');

  state.launchChart = new Chart(launchCtx, {
    type: 'line',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      datasets: [{
        label: 'Rocket Launches (2025)',
        data: [14, 18, 22, 19, 25, 31, 28, 35, 42, 38, 48, 55],
        borderColor: '#7b61ff',
        borderWidth: 2,
        backgroundColor: gradient,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#00f5ff',
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { family: 'JetBrains Mono', size: 9 } }
        },
        y: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { family: 'JetBrains Mono', size: 9 } }
        }
      }
    }
  });

  state.missionChart = new Chart(missionCtx, {
    type: 'doughnut',
    data: {
      labels: ['LEO', 'GEO', 'Lunar Orbit', 'Mars Transit', 'Deep Space'],
      datasets: [{
        data: [45, 20, 15, 12, 8],
        backgroundColor: ['#7b61ff', '#06b6d4', '#ffd166', '#ff5d73', '#10b981'],
        borderWidth: isLight ? 1 : 0,
        borderColor: isLight ? '#fff' : 'transparent'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: textColor,
            font: { family: 'Inter', size: 10 },
            boxWidth: 10
          }
        }
      },
      cutout: '70%'
    }
  });
}

function updateDashboardChartsTheme() {
  if (!state.launchChart || !state.missionChart) return;
  const isLight = state.theme === 'light';
  const gridColor = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';
  const textColor = isLight ? '#475569' : '#9ca3af';

  state.launchChart.options.scales.x.grid.color = gridColor;
  state.launchChart.options.scales.x.ticks.color = textColor;
  state.launchChart.options.scales.y.grid.color = gridColor;
  state.launchChart.options.scales.y.ticks.color = textColor;
  state.launchChart.update();

  state.missionChart.options.plugins.legend.labels.color = textColor;
  state.missionChart.data.datasets[0].borderWidth = isLight ? 1 : 0;
  state.missionChart.data.datasets[0].borderColor = isLight ? '#fff' : 'transparent';
  state.missionChart.update();
}

// Mini ISS tracker — fetches real coordinates from live API
async function initMiniISSTracker() {
  const updateMiniISS = async () => {
    try {
      const data = await fetchISS_Location();
      const lat = parseFloat(data.latitude);
      const lon = parseFloat(data.longitude);
      const latDir = lat >= 0 ? 'N' : 'S';
      const lonDir = lon >= 0 ? 'E' : 'W';
      const latEl = document.getElementById('mini-iss-lat');
      const lonEl = document.getElementById('mini-iss-lon');
      if (latEl) latEl.textContent = `${Math.abs(lat).toFixed(4)} ° ${latDir}`;
      if (lonEl) lonEl.textContent = `${Math.abs(lon).toFixed(4)} ° ${lonDir}`;
    } catch (e) {
      // Silently fail mini tracker — non-critical
    }
  };
  updateMiniISS();
  setInterval(updateMiniISS, 5000);
}

// Bento interactive links
function initBentoNavigation() {
  const cards = document.querySelectorAll('.glass-card-interactive');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      const targetPage = card.getAttribute('data-target-page');
      if (targetPage) {
        playSynthSound('click');
        window.location.hash = `#/${targetPage}`;
      }
    });
  });
}

// Cosmic random fact driver
function initCosmicFactGenerator() {
  const facts = [
    "One day on Venus is longer than one year. It takes Venus longer to rotate once on its axis than to complete one orbit around the sun.",
    "Neutron stars are so dense that a single teaspoon of their material would weigh about 6 billion tons on Earth.",
    "There are more trees on Earth than stars in the Milky Way. Trees: ~3 trillion; Stars: 100-400 billion.",
    "Footprints left by Apollo astronauts on the Moon will stay there for at least 100 million years because there is no atmosphere or wind.",
    "In space, two pieces of the same metal will permanently bond if they touch. This process is called cold welding.",
    "The Sun is massive enough that approximately 1.3 million Earths could fit inside it.",
    "A spacecraft traveling at the speed of light would still take 100,000 years to traverse the entire length of our Milky Way galaxy."
  ];

  const factText = document.getElementById('dash-space-fact-text');
  const refreshBtn = document.getElementById('dash-space-fact-refresh');

  if (!factText || !refreshBtn) return;

  refreshBtn.addEventListener('click', () => {
    playSynthSound('click');
    const randomFact = facts[Math.floor(Math.random() * facts.length)];
    
    if (typeof gsap !== 'undefined') {
      gsap.to(factText, {
        opacity: 0,
        y: -5,
        duration: 0.2,
        onComplete: () => {
          factText.textContent = `"${randomFact}"`;
          gsap.to(factText, {
            opacity: 1,
            y: 0,
            duration: 0.3,
            ease: 'power2.out'
          });
        }
      });
    } else {
      factText.textContent = `"${randomFact}"`;
    }
  });
}

// Real-time telemetry log stream
function initTelemetryStream() {
  const telemetryPool = [
    { text: "Secure telemetry hand-shake verified with Mars Reconnaissance Orbiter.", badge: "success", type: "MRO-LINK" },
    { text: "Detected anomalous solar electromagnetic radiation deflection of +0.024%.", badge: "info", type: "SDO-MONITOR" },
    { text: "Received high-resolution radar sensory packet from Titan polar orbiters.", badge: "success", type: "CASSINI-DEEP" },
    { text: "Adjusting orbital attitude alignment for International Space Station (+0.12° pitch).", badge: "info", type: "ISS-ATTITUDE" },
    { text: "Deep Space Network station DSS-63 (Madrid) reports weak secondary carrier signal.", badge: "danger", type: "DSN-STATION" },
    { text: "Solar sail solar pressure calculations synchronized for planetary transit shuttle.", badge: "success", type: "SOL-SAIL-S3" },
    { text: "Telemetry drift warning: Secondary communications router temp exceeding 82°C.", badge: "danger", type: "ROUTER-TEMP" }
  ];

  const feedContainer = document.getElementById('dash-telemetry-feed');
  if (!feedContainer) return;

  setInterval(() => {
    const log = telemetryPool[Math.floor(Math.random() * telemetryPool.length)];
    const time = new Date().toUTCString().split(' ')[4];
    
    const logItem = document.createElement('div');
    logItem.className = 'activity-item';
    logItem.style.opacity = '0';
    logItem.style.transform = 'translateY(10px)';
    
    logItem.innerHTML = `
      <div class="activity-badge ${log.badge}">
        <i class="fa-solid ${log.badge === 'success' ? 'fa-circle-check' : log.badge === 'danger' ? 'fa-radiation' : 'fa-satellite-dish'}"></i>
      </div>
      <div class="activity-details">
        <span class="activity-text">${log.text}</span>
        <span class="activity-meta">${time} UTC • ID: ${log.type} • LINK STABLE</span>
      </div>
    `;

    feedContainer.prepend(logItem);
    playSynthSound('click');

    // Retain only latest 5 items
    if (feedContainer.children.length > 5) {
      feedContainer.removeChild(feedContainer.lastElementChild);
    }

    if (typeof gsap !== 'undefined') {
      gsap.to(logItem, {
        opacity: 1,
        y: 0,
        duration: 0.35,
        ease: 'power2.out'
      });
    } else {
      logItem.style.opacity = '1';
      logItem.style.transform = 'none';
    }
  }, 12000);
}

// Hero banner interaction and PDF report compiler
function initHeroActionButtons() {
  const exploreBtn = document.getElementById('hero-action-explore-btn');
  const exportBtn = document.getElementById('hero-action-export-btn');

  if (exploreBtn) {
    exploreBtn.addEventListener('click', () => {
      playSynthSound('success');
      navigateToPage('planets');
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      playSynthSound('success');
      showToast('GENERATING TELEMETRY REPORT...', 'success');
      
      try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFont("courier", "bold");
        doc.setFontSize(18);
        doc.text("========================================", 14, 15);
        doc.text("             A S T R O S C O P E        ", 14, 25);
        doc.text("        MISSION COMMAND TELEMETRY REPORT ", 14, 32);
        doc.text("========================================", 14, 40);
        
        doc.setFont("courier", "normal");
        doc.setFontSize(10);
        
        const timestamp = new Date().toUTCString();
        const customStardate = document.getElementById('star-date-val') ? document.getElementById('star-date-val').textContent : 'STARDATE.9924.3';
        
        doc.text(`UT CALIBRATION TIMESTAMP : ${timestamp}`, 14, 52);
        doc.text(`MISSION STARDATE INDEX   : ${customStardate}`, 14, 58);
        doc.text(`SYSTEM LINK COMPLEMENT   : 100% SECURE DIRECT FEED`, 14, 64);
        doc.text(`ORBITAL STATUS INDEX     : SECTOR GREEN - STABLE`, 14, 70);
        
        doc.text("----------------------------------------", 14, 78);
        doc.text("ASTRONOMICAL TELEMETRY SUB-UNITS", 14, 84);
        doc.text("----------------------------------------", 14, 90);
        
        const lat = document.getElementById('mini-iss-lat') ? document.getElementById('mini-iss-lat').textContent : '51.4822 ° N';
        const lon = document.getElementById('mini-iss-lon') ? document.getElementById('mini-iss-lon').textContent : '0.0077 ° E';
        doc.text(`1. ACTIVE ORBITER LATITUDE   : ${lat}`, 14, 100);
        doc.text(`2. ACTIVE ORBITER LONGITUDE  : ${lon}`, 14, 106);
        doc.text(`3. SPACE STATION VELOCITY    : 27,560 KM/H`, 14, 112);
        doc.text(`4. LAUNCH COUNTDOWN STATUS   : Falcon 9 • ACTIVE COUNTDOWN`, 14, 118);
        doc.text(`5. MARS PHOTO DATA SOL INDEX : SOL 1920 RAW LOGGER`, 14, 124);
        
        doc.text("----------------------------------------", 14, 134);
        doc.text("DEEP SPACE REAL-TIME LOGGER (DSN STATIONS)", 14, 140);
        doc.text("----------------------------------------", 14, 146);
        
        doc.text("* Goldstone DSS-14: Secure uplink verified. S/N 22.4dB.", 14, 156);
        doc.text("* SDO Station: CME sector M-class flare detected.", 14, 162);
        doc.text("* Madrid DSS-63: Synchronizing Voyager 1 carrier trajectory.", 14, 168);
        doc.text("* Cape Canaveral: Pad SLC-39A pre-launch checks green.", 14, 174);
        
        doc.text("========================================", 14, 188);
        doc.text("           END OF SIGNAL PACKET          ", 14, 196);
        doc.text("========================================", 14, 202);
        
        doc.save(`astroscope-telemetry-report.pdf`);
        showToast('TELEMETRY PDF EXPORT COMPLETED', 'success');
      } catch (err) {
        console.error('PDF generation crash:', err);
        showToast('PDF compilation pipeline failure', 'error');
      }
    });
  }
}

// Hub initializer for all Phase 2 Dashboard elements
function initDashboardControllers() {
  initLaunchCountdown();
  initDashboardCharts();
  initMiniISSTracker();
  initBentoNavigation();
  initCosmicFactGenerator();
  initTelemetryStream();
  initHeroActionButtons();
}

/* ==========================================================================
   PHASE 3 & 4: LIVE VIEWS CONTROLLERS & DATA STREAM SERVICES
   ========================================================================== */

// Page-specific loaders dispatcher called on routing
export function triggerPageLoad(pageId) {
  // Clear any active ISS background tracking intervals first
  if (state.issIntervalId) {
    clearInterval(state.issIntervalId);
    state.issIntervalId = null;
  }
  // Clear active countdown intervals
  state.activeCountdownIntervals.forEach(clearInterval);
  state.activeCountdownIntervals = [];

  switch (pageId) {
    case 'iss':
      initIssController();
      break;
    case 'launches':
      initLaunchesController();
      break;
    case 'planets':
      initPlanetsController();
      break;
    case 'mars':
      initMarsController();
      break;
    case 'earth':
      initEarthController();
      break;
    case 'apod':
      initApodController();
      break;
    case 'events':
      initEventsController();
      break;
    case 'settings':
      initSettingsController();
      break;
  }
}

/**
 * 1. ISS Tracking Controller
 */
async function initIssController() {
  const loader = document.getElementById('iss-loader-container');
  const content = document.getElementById('iss-content-grid');
  const errorPanel = document.getElementById('iss-error-container');

  const showLoading = () => {
    if (loader) loader.classList.remove('hidden');
    if (content) content.classList.add('hidden');
    if (errorPanel) errorPanel.classList.add('hidden');
  };

  const showContent = () => {
    if (loader) loader.classList.add('hidden');
    if (content) content.classList.remove('hidden');
    if (errorPanel) errorPanel.classList.add('hidden');
  };

  const showError = (msg) => {
    if (loader) loader.classList.add('hidden');
    if (content) content.classList.add('hidden');
    if (errorPanel) {
      errorPanel.classList.remove('hidden');
      const text = errorPanel.querySelector('p');
      if (text) text.textContent = msg || 'Failed to establish ISS secure telemetry stream.';
    }
  };

  // Wire retry button
  const retryBtn = document.getElementById('iss-retry-btn');
  if (retryBtn) {
    // Re-bind click event
    retryBtn.onclick = () => {
      playSynthSound('click');
      initIssController();
    };
  }

  showLoading();

  try {
    // 1. Fetch Astronauts List
    const crewData = await fetchAstronautsInSpace();
    const crewListContainer = document.getElementById('iss-crew-list');
    const crewCountEl = document.getElementById('iss-crew-count');

    if (crewCountEl) crewCountEl.textContent = crewData.number || crewData.people.length;

    if (crewListContainer && crewData.people) {
      crewListContainer.innerHTML = crewData.people.map(person => `
        <div class="crew-card">
          <span class="crew-name">${person.name}</span>
          <span class="crew-craft-badge">${person.craft}</span>
        </div>
      `).join('');
    }

    // 2. Fetch ISS Location
    const issData = await fetchISS_Location();
    const lat = parseFloat(issData.latitude);
    const lon = parseFloat(issData.longitude);

    updateIssTelemetryUI(issData);

    // 3. Setup Leaflet Map
    const mapContainer = document.getElementById('iss-map');
    if (mapContainer) {
      // Clean up map container if already initialized
      if (state.issMap) {
        state.issMap.remove();
        state.issMap = null;
      }

      state.issMap = L.map('iss-map', { zoomControl: false }).setView([lat, lon], 3);
      
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CartoDB</a> contributors'
      }).addTo(state.issMap);

      L.control.zoom({ position: 'bottomright' }).addTo(state.issMap);

      state.issMarker = L.circleMarker([lat, lon], {
        radius: 12,
        color: '#00f5ff',
        fillColor: '#00f5ff',
        fillOpacity: 0.8,
        weight: 2
      }).addTo(state.issMap);

      // Create glowing orbit pulse
      let pulseDir = 1;
      let pulseRadius = 12;
      setInterval(() => {
        if (!state.issMarker || !state.issMap) return;
        pulseRadius += pulseDir * 0.5;
        if (pulseRadius > 18 || pulseRadius < 10) pulseDir *= -1;
        state.issMarker.setRadius(pulseRadius);
      }, 100);
    }

    // Bind recenter button
    const recenterBtn = document.getElementById('iss-recenter-map');
    if (recenterBtn) {
      recenterBtn.onclick = () => {
        playSynthSound('click');
        if (state.issMap && state.issMarker) {
          state.issMap.panTo(state.issMarker.getLatLng(), { animate: true, duration: 1.0 });
          showToast('VIEWPORT ALIGNED TO ORBITER', 'success');
        }
      };
    }

    showContent();

    // Call Leaflet map size invalidation to recalculate bounds once active
    setTimeout(() => {
      if (state.issMap) {
        state.issMap.invalidateSize();
      }
    }, 500);

    // 4. Background Interval updates (every 4 seconds)
    state.issIntervalId = setInterval(async () => {
      try {
        const liveLoc = await fetchISS_Location();
        const liveLat = parseFloat(liveLoc.latitude);
        const liveLon = parseFloat(liveLoc.longitude);

        updateIssTelemetryUI(liveLoc);

        if (state.issMarker) {
          state.issMarker.setLatLng([liveLat, liveLon]);
        }
      } catch (err) {
        console.warn('Silent ISS telemetry background polling failure:', err);
      }
    }, 4000);

  } catch (error) {
    console.error('Failed to initialize ISS controller:', error);
    showError(error.message === 'NETWORK_OFFLINE' ? 'Orbital link interrupted: Network Offline.' : null);
  }
}

function updateIssTelemetryUI(data) {
  const latEl = document.getElementById('iss-telemetry-lat');
  const lonEl = document.getElementById('iss-telemetry-lon');
  const altEl = document.getElementById('iss-telemetry-alt');
  const velEl = document.getElementById('iss-telemetry-vel');
  const sunEl = document.getElementById('iss-telemetry-footprint');

  const lat = parseFloat(data.latitude);
  const lon = parseFloat(data.longitude);
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';

  if (latEl) latEl.textContent = `${Math.abs(lat).toFixed(4)} ° ${latDir}`;
  if (lonEl) lonEl.textContent = `${Math.abs(lon).toFixed(4)} ° ${lonDir}`;
  if (altEl) altEl.textContent = `${parseFloat(data.altitude).toFixed(1)} KM`;
  if (velEl) velEl.textContent = `${parseFloat(data.velocity).toLocaleString(undefined, { maximumFractionDigits: 0 })} KM/H`;
  if (sunEl) sunEl.textContent = `4,500 KM`; // Static orbital footprint dia

  // Also sync mini-ISS tracker on dashboard
  const miniLatEl = document.getElementById('mini-iss-lat');
  const miniLonEl = document.getElementById('mini-iss-lon');
  if (miniLatEl) miniLatEl.textContent = `${Math.abs(lat).toFixed(4)} ° ${latDir}`;
  if (miniLonEl) miniLonEl.textContent = `${Math.abs(lon).toFixed(4)} ° ${lonDir}`;
}

/**
 * 2. Launches Center Controller
 */
async function initLaunchesController() {
  const loader = document.getElementById('launch-loading-indicator');
  const listGrid = document.getElementById('launch-schedule-list');
  const errorPanel = document.getElementById('launch-error-state');

  const showLoading = () => {
    if (loader) loader.classList.remove('hidden');
    if (listGrid) listGrid.classList.add('hidden');
    if (errorPanel) errorPanel.classList.add('hidden');
  };

  const showContent = () => {
    if (loader) loader.classList.add('hidden');
    if (listGrid) listGrid.classList.remove('hidden');
    if (errorPanel) errorPanel.classList.add('hidden');
  };

  const showError = (msg) => {
    if (loader) loader.classList.add('hidden');
    if (listGrid) listGrid.classList.add('hidden');
    if (errorPanel) {
      errorPanel.classList.remove('hidden');
      const text = errorPanel.querySelector('p');
      if (text) text.textContent = msg || 'Failed to download rocket telemetry timeline catalogs.';
    }
  };

  // Bind retry button
  const retryBtn = document.getElementById('launch-retry-btn');
  if (retryBtn) {
    retryBtn.onclick = () => {
      playSynthSound('click');
      initLaunchesController();
    };
  }

  showLoading();

  try {
    const [libData, spxData] = await Promise.all([
      fetchUpcomingRocketLaunches(),
      fetchSpaceXLaunches()
    ]);

    // 1. Calculate launch statistics metrics
    const totalScheduled = libData.results ? libData.results.length : 3;
    const spacexFlights = spxData.upcoming ? (spxData.upcoming.length + spxData.past.length) : 310;
    const successRate = spxData.past ? ((spxData.past.filter(l => l.success).length / spxData.past.length) * 100).toFixed(1) : '99.1';

    const totalEl = document.getElementById('launch-stat-total');
    const spxEl = document.getElementById('launch-stat-spacex');
    const rateEl = document.getElementById('launch-stat-success');

    if (totalEl) totalEl.textContent = totalScheduled;
    if (spxEl) spxEl.textContent = spacexFlights;
    if (rateEl) rateEl.textContent = `${successRate}%`;

    // 2. Render schedule cards
    if (listGrid && libData.results) {
      listGrid.innerHTML = libData.results.map((launch, index) => {
        const netDate = new Date(launch.net);
        const dateStr = netDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
        const timeStr = netDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
        
        // Match a reliable image
        const imgUrl = launch.image || 'https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?q=80&w=600&auto=format&fit=crop';
        const provider = launch.launch_service_provider ? launch.launch_service_provider.name : 'Aerospace Provider';
        const padName = launch.pad ? launch.pad.name : 'Launch Complex';
        const locationName = launch.pad && launch.pad.location ? launch.pad.location.name : 'Unknown Sector';
        const missionDesc = launch.mission ? launch.mission.description : 'Space flight payload orbit injection mission.';

        return `
          <div class="launch-card glass-panel" data-provider="${provider.toLowerCase()}" data-search="${launch.name.toLowerCase()}">
            <div class="launch-card-media">
              <img src="${imgUrl}" alt="Rocket launch" loading="lazy" referrerPolicy="no-referrer">
              <span class="launch-provider-tag">${provider}</span>
              <span class="launch-badge-upcoming">T-MINUS</span>
            </div>
            <div class="launch-card-body">
              <h4 class="launch-card-title">${launch.name}</h4>
              <div class="launch-card-meta">
                <span class="launch-meta-line">
                  <i class="fa-solid fa-calendar"></i>
                  <span>${dateStr} • ${timeStr}</span>
                </span>
                <span class="launch-meta-line">
                  <i class="fa-solid fa-map-pin"></i>
                  <span>${padName}, ${locationName}</span>
                </span>
              </div>
              <p class="launch-card-description">${missionDesc}</p>
              
              <div class="launch-card-countdown">
                <span class="text-xs text-muted">COUNTDOWN</span>
                <span class="countdown-live-ticker" id="ticker-${index}" data-time="${launch.net}">CALIBRATING</span>
              </div>
            </div>
          </div>
        `;
      }).join('');

      // 3. Spin active live countdown tickers
      libData.results.forEach((launch, index) => {
        const ticker = document.getElementById(`ticker-${index}`);
        if (!ticker) return;

        const targetDate = new Date(launch.net).getTime();

        const updateTicker = () => {
          const delta = targetDate - Date.now();
          if (delta <= 0) {
            ticker.textContent = "LAUNCH COMPLETED";
            ticker.style.color = "var(--text-muted)";
            return;
          }

          const days = Math.floor(delta / (1000 * 60 * 60 * 24));
          const hours = Math.floor((delta % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const mins = Math.floor((delta % (1000 * 60 * 60)) / (1000 * 60));
          const secs = Math.floor((delta % (1000 * 60)) / 1000);

          ticker.textContent = `${days}D ${hours}H ${mins}M ${secs}S`;
        };

        updateTicker();
        const intervalId = setInterval(updateTicker, 1000);
        state.activeCountdownIntervals.push(intervalId);
      });

      // 4. Set up live search and dropdown filters
      const searchInput = document.getElementById('launch-search-input');
      const providerFilter = document.getElementById('launch-provider-filter');

      const applyFilters = () => {
        const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const providerVal = providerFilter ? providerFilter.value.toLowerCase() : 'all';

        const cards = listGrid.querySelectorAll('.launch-card');
        cards.forEach(card => {
          const cardSearch = card.getAttribute('data-search') || '';
          const cardProvider = card.getAttribute('data-provider') || '';

          const matchSearch = cardSearch.includes(searchVal);
          const matchProvider = providerVal === 'all' || cardProvider.includes(providerVal);

          if (matchSearch && matchProvider) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });
      };

      if (searchInput) searchInput.onkeyup = applyFilters;
      if (providerFilter) providerFilter.onchange = () => {
        playSynthSound('click');
        applyFilters();
      };
    }

    showContent();

  } catch (error) {
    console.error('Launches Controller Init failure:', error);
    showError(error.message === 'NETWORK_OFFLINE' ? 'Uplink down: network offline.' : null);
  }
}

/**
 * 3. Mars Rover Photo Gallery Controller
 */
async function initMarsController() {
  const loader = document.getElementById('mars-loading-indicator');
  const emptyState = document.getElementById('mars-empty-state');
  const errorPanel = document.getElementById('mars-error-state');
  const photosGrid = document.getElementById('mars-photos-grid');

  const showLoading = () => {
    if (loader) loader.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    if (photosGrid) photosGrid.classList.add('hidden');
    if (errorPanel) errorPanel.classList.add('hidden');
  };

  const showPhotos = () => {
    if (loader) loader.classList.add('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    if (photosGrid) photosGrid.classList.remove('hidden');
    if (errorPanel) errorPanel.classList.add('hidden');
  };

  const showEmpty = () => {
    if (loader) loader.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    if (photosGrid) photosGrid.classList.add('hidden');
    if (errorPanel) errorPanel.classList.add('hidden');
  };

  const showError = (msg) => {
    if (loader) loader.classList.add('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    if (photosGrid) photosGrid.classList.add('hidden');
    if (errorPanel) {
      errorPanel.classList.remove('hidden');
      const text = errorPanel.querySelector('p');
      if (text) text.textContent = msg || 'Failed to acquire Mars rover sensor telemetry.';
    }
  };

  const fetchBtn = document.getElementById('mars-fetch-btn');
  const roverSelect = document.getElementById('mars-rover-select');
  const solInput = document.getElementById('mars-sol-input');
  const cameraSelect = document.getElementById('mars-camera-select');
  const retryBtn = document.getElementById('mars-retry-btn');

  if (retryBtn) {
    retryBtn.onclick = () => {
      playSynthSound('click');
      loadPhotos();
    };
  }

  const loadPhotos = async () => {
    showLoading();
    
    const rover = roverSelect ? roverSelect.value : 'curiosity';
    const sol = solInput ? solInput.value : 1000;
    const camera = cameraSelect ? cameraSelect.value : 'ALL';

    try {
      const data = await fetchMarsRoverPhotos(rover, sol, camera);
      if (!data.photos || data.photos.length === 0) {
        showEmpty();
        return;
      }

      if (photosGrid) {
        photosGrid.innerHTML = data.photos.map(photo => `
          <div class="mars-photo-card glass-panel" data-src="${photo.img_src}" data-camera="${photo.camera.full_name}" data-date="${photo.earth_date}" data-sol="${photo.sol}" data-rover="${photo.rover.name}">
            <img src="${photo.img_src}" alt="Mars raw landscape capture" loading="lazy" referrerPolicy="no-referrer">
            <div class="mars-photo-info">
              <span class="camera-badge"><i class="fa-solid fa-camera"></i> ${photo.camera.name}</span>
              <span class="sol-badge">SOL ${photo.sol}</span>
            </div>
          </div>
        `).join('');

        // Lightbox modal trigger hookups
        const cards = photosGrid.querySelectorAll('.mars-photo-card');
        cards.forEach(card => {
          card.onclick = () => {
            playSynthSound('success');
            const src = card.getAttribute('data-src');
            const camera = card.getAttribute('data-camera');
            const date = card.getAttribute('data-date');
            const sol = card.getAttribute('data-sol');
            const rover = card.getAttribute('data-rover');

            const modal = document.getElementById('mars-photo-modal');
            const modalImg = document.getElementById('modal-image');
            const modalRover = document.getElementById('modal-rover');
            const modalCamera = document.getElementById('modal-camera');
            const modalSol = document.getElementById('modal-sol');
            const modalDate = document.getElementById('modal-date');

            if (modal && modalImg) {
              modalImg.src = src;
              if (modalRover) modalRover.textContent = rover.toUpperCase();
              if (modalCamera) modalCamera.textContent = camera;
              if (modalSol) modalSol.textContent = `SOL INDEX: ${sol}`;
              if (modalDate) modalDate.textContent = `EARTH CALIBRATION DATE: ${date}`;

              modal.classList.remove('hidden');

              // Modal close action
              const closeBtn = document.getElementById('modal-close-btn');
              if (closeBtn) {
                closeBtn.onclick = () => {
                  playSynthSound('click');
                  modal.classList.add('hidden');
                };
              }
              // Backdrop click close
              modal.onclick = (e) => {
                if (e.target === modal) {
                  modal.classList.add('hidden');
                }
              };
            }
          };
        });
      }

      showPhotos();

    } catch (err) {
      console.error('Mars photos download crash:', err);
      if (err.message === 'NASA_RATE_LIMIT') {
        showNasaRateLimitError();
        showError('NASA API rate limit reached. Add your free key in ⚙️ Settings to continue.');
      } else {
        showError(err.message === 'NETWORK_OFFLINE' ? 'Signal failed: network offline.' : null);
      }
    }
  };

  if (fetchBtn) {
    fetchBtn.onclick = () => {
      playSynthSound('click');
      loadPhotos();
    };
  }

  // Auto load first photos batch if empty
  if (photosGrid && photosGrid.children.length === 0) {
    loadPhotos();
  } else {
    showPhotos();
  }
}

/**
 * Helper: show NASA rate limit toast with Settings prompt
 */
function showNasaRateLimitError() {
  showToast('NASA API RATE LIMIT HIT — Add your free API key in Settings!', 'warning');
}

/**
 * 4. Earth Live View EPIC Controller
 */
async function initEarthController() {
  const loader = document.getElementById('earth-loading-indicator');
  const liveScreen = document.getElementById('earth-viewport-container');
  const errorPanel = document.getElementById('earth-error-state');

  const showLoading = () => {
    if (loader) loader.classList.remove('hidden');
    if (liveScreen) liveScreen.classList.add('hidden');
    if (errorPanel) errorPanel.classList.add('hidden');
  };

  const showContent = () => {
    if (loader) loader.classList.add('hidden');
    if (liveScreen) liveScreen.classList.remove('hidden');
    if (errorPanel) errorPanel.classList.add('hidden');
  };

  const showError = (msg) => {
    if (loader) loader.classList.add('hidden');
    if (liveScreen) liveScreen.classList.add('hidden');
    if (errorPanel) {
      errorPanel.classList.remove('hidden');
      const text = errorPanel.querySelector('p');
      if (text) text.textContent = msg || 'Failed to synchronise EPIC planetary live imaging payload.';
    }
  };

  showLoading();

  try {
    const data = await fetchEarthLiveEPIC();
    if (!data || data.length === 0) {
      showError('No daylight EPIC imagery files available for today.');
      return;
    }

    state.earthPhotos = data;
    state.earthIndex = 0;

    const renderImage = () => {
      const activeImg = state.earthPhotos[state.earthIndex];
      const datePart = activeImg.date.split(' ')[0]; // "2025-02-14"
      const [year, month, day] = datePart.split('-');
      
      const apiKey = getNasaApiKey();
      const imgUrl = `https://api.nasa.gov/EPIC/archive/natural/${year}/${month}/${day}/png/${activeImg.image}.png?api_key=${apiKey}`;

      const epicImg = document.getElementById('earth-epic-img');
      const counter = document.getElementById('earth-grid-count');
      const caption = document.getElementById('earth-epic-caption');
      
      const coordEl = document.getElementById('earth-telemetry-coord');
      const timeEl = document.getElementById('earth-telemetry-time');
      const posEl = document.getElementById('earth-telemetry-pos');

      if (epicImg) {
        // Simple GSAP transition on changing image
        if (typeof gsap !== 'undefined') {
          gsap.to(epicImg, {
            opacity: 0.1,
            scale: 0.98,
            duration: 0.2,
            onComplete: () => {
              epicImg.src = imgUrl;
              epicImg.onload = () => {
                gsap.to(epicImg, { opacity: 1, scale: 1, duration: 0.45 });
              };
            }
          });
        } else {
          epicImg.src = imgUrl;
        }
      }

      if (counter) counter.textContent = `IMAGE ${state.earthIndex + 1} / ${state.earthPhotos.length}`;
      if (caption) caption.textContent = `${activeImg.caption}`;

      if (coordEl && activeImg.centroid_coordinates) {
        coordEl.textContent = `Lat: ${parseFloat(activeImg.centroid_coordinates.lat).toFixed(2)}° | Lon: ${parseFloat(activeImg.centroid_coordinates.lon).toFixed(2)}°`;
      }
      if (timeEl) {
        timeEl.textContent = `${activeImg.date.split(' ')[1]} UTC`;
      }

      if (activeImg.sun_j2000_position && posEl) {
        posEl.textContent = `X: ${parseFloat(activeImg.sun_j2000_position.x).toFixed(1)} Y: ${parseFloat(activeImg.sun_j2000_position.y).toFixed(1)} Z: ${parseFloat(activeImg.sun_j2000_position.z).toFixed(1)}`;
      }
    };

    renderImage();

    // Wire sliders
    const prevBtn = document.getElementById('earth-btn-prev');
    const nextBtn = document.getElementById('earth-btn-next');

    if (prevBtn) {
      prevBtn.onclick = () => {
        playSynthSound('click');
        state.earthIndex = (state.earthIndex - 1 + state.earthPhotos.length) % state.earthPhotos.length;
        renderImage();
      };
    }

    if (nextBtn) {
      nextBtn.onclick = () => {
        playSynthSound('click');
        state.earthIndex = (state.earthIndex + 1) % state.earthPhotos.length;
        renderImage();
      };
    }

    showContent();

    // Wire Earth retry button
    const retryBtn = document.getElementById('earth-retry-btn');
    if (retryBtn) {
      retryBtn.onclick = () => {
        playSynthSound('click');
        initEarthController();
      };
    }

  } catch (error) {
    console.error('EPIC Earth controller startup failure:', error);
    if (error.message === 'NASA_RATE_LIMIT') {
      showNasaRateLimitError();
      showError('NASA API rate limit reached. Add your free API key in ⚙️ Settings to continue.');
    } else {
      showError(error.message === 'NETWORK_OFFLINE' ? 'Signal connection failed: network offline.' : null);
    }

    // Wire retry even on error
    const retryBtn = document.getElementById('earth-retry-btn');
    if (retryBtn) {
      retryBtn.onclick = () => {
        playSynthSound('click');
        initEarthController();
      };
    }
  }
}

/**
 * 5. NASA APOD Gallery Controller
 */
async function initApodController() {
  const loader = document.getElementById('apod-loading-indicator');
  const displayPanel = document.getElementById('apod-content-panel');
  const errorPanel = document.getElementById('apod-error-state');

  const showLoading = () => {
    if (loader) loader.classList.remove('hidden');
    if (displayPanel) displayPanel.classList.add('hidden');
    if (errorPanel) errorPanel.classList.add('hidden');
  };

  const showContent = () => {
    if (loader) loader.classList.add('hidden');
    if (displayPanel) displayPanel.classList.remove('hidden');
    if (errorPanel) errorPanel.classList.add('hidden');
  };

  const showError = (msg) => {
    if (loader) loader.classList.add('hidden');
    if (displayPanel) displayPanel.classList.add('hidden');
    if (errorPanel) {
      errorPanel.classList.remove('hidden');
      const text = errorPanel.querySelector('p');
      if (text) text.textContent = msg || 'Failed to download Astronomy Picture of the Day data packet.';
    }
  };

  const dateInput = document.getElementById('apod-date-picker');
  const fetchBtn = document.getElementById('apod-fetch-btn');

  const loadApod = async () => {
    showLoading();
    const dateVal = dateInput ? dateInput.value : '';

    try {
      const data = await fetchNASA_APOD(dateVal);

      const titleEl = document.getElementById('apod-title');
      const descEl = document.getElementById('apod-explanation');
      const dateEl = document.getElementById('apod-date-val');
      const copyrightEl = document.getElementById('apod-copyright-val');
      
      const mediaWrapper = document.getElementById('apod-media-container');
      const downloadLink = document.getElementById('apod-download-link');
      if (downloadLink) {
        downloadLink.href = data.hdurl || data.url;
      }

      if (titleEl) titleEl.textContent = data.title || 'UNCLASSIFIED COSMIC LANDSCAPE';
      if (descEl) descEl.textContent = data.explanation || 'Detailed cosmic spatial description awaiting telemetry clearance.';
      if (dateEl) dateEl.textContent = `DATE: ${data.date}`;
      if (copyrightEl) copyrightEl.textContent = `COPYRIGHT: ${data.copyright || 'PUBLIC DOMAIN'}`;

      if (mediaWrapper) {
        if (data.media_type === 'video') {
          mediaWrapper.innerHTML = `<iframe src="${data.url}" title="${data.title || 'APOD Video'}" width="100%" height="450" allowfullscreen referrerPolicy="no-referrer" style="border:none;border-radius:8px;"></iframe>`;
        } else {
          const imgUrl = data.hdurl || data.url;
          const img = document.createElement('img');
          img.src = imgUrl;
          img.alt = 'APOD Spatial high-resolution vector capture';
          img.loading = 'lazy';
          img.referrerPolicy = 'no-referrer';
          img.onerror = () => {
            img.src = data.url; // Fall back to SD url if HD fails
            img.onerror = () => { img.alt = 'Image unavailable'; };
          };
          mediaWrapper.innerHTML = '';
          mediaWrapper.appendChild(img);
        }
      }

      // 1. Configure Bookmark system
      const favoriteBtn = document.getElementById('apod-favorite-btn');
      if (favoriteBtn) {
        let favorites = JSON.parse(localStorage.getItem('astro-favorites') || '[]');
        const isFav = favorites.some(fav => fav.date === data.date);
        
        const favIcon = favoriteBtn.querySelector('i');
        const favText = favoriteBtn.querySelector('span');

        if (isFav) {
          if (favIcon) favIcon.className = 'fa-solid fa-heart text-danger';
          if (favText) favText.textContent = 'BOOKMARKED';
        } else {
          if (favIcon) favIcon.className = 'fa-regular fa-heart';
          if (favText) favText.textContent = 'BOOKMARK DATA';
        }

        favoriteBtn.onclick = () => {
          playSynthSound('success');
          favorites = JSON.parse(localStorage.getItem('astro-favorites') || '[]');
          const idx = favorites.findIndex(fav => fav.date === data.date);

          if (idx > -1) {
            favorites.splice(idx, 1);
            if (favIcon) favIcon.className = 'fa-regular fa-heart';
            if (favText) favText.textContent = 'BOOKMARK DATA';
            showToast('COSMIC DATA UN-BOOKMARKED');
          } else {
            favorites.push({ date: data.date, title: data.title, url: data.url });
            if (favIcon) favIcon.className = 'fa-solid fa-heart text-danger';
            if (favText) favText.textContent = 'BOOKMARKED';
            showToast('COSMIC DATA BOOKMARKED SECURELY', 'success');
          }
          localStorage.setItem('astro-favorites', JSON.stringify(favorites));
        };
      }

      showContent();

    } catch (err) {
      console.error('APOD Core retrieval crash:', err);
      if (err.message === 'NASA_RATE_LIMIT') {
        showNasaRateLimitError();
        showError('NASA API rate limit reached. Add your free API key in ⚙️ Settings to unlock unlimited access.');
      } else {
        showError(err.message === 'NETWORK_OFFLINE' ? 'Signal failed: network offline.' : null);
      }
    }
  };

  // Wire APOD retry button
  const retryBtn = document.getElementById('apod-retry-btn');
  if (retryBtn) {
    retryBtn.onclick = () => {
      playSynthSound('click');
      loadApod();
    };
  }

  if (fetchBtn) {
    fetchBtn.onclick = () => {
      playSynthSound('click');
      loadApod();
    };
  }

  // Trigger load on date change
  if (dateInput) {
    // Set max date to today
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('max', today);

    dateInput.onchange = () => {
      playSynthSound('click');
      loadApod();
    };
  }

  // Pre-load default APOD
  if (displayPanel && displayPanel.classList.contains('hidden')) {
    loadApod();
  } else {
    showContent();
  }
}

/**
 * 6. Mission Control Settings Panel Controller
 */
/**
 * 4. Planet Explorer & Gravity Simulator Controller
 */
async function initPlanetsController() {
  const loader = document.getElementById('planets-loader-container');
  const errorPanel = document.getElementById('planets-error-container');
  const contentLayout = document.getElementById('planets-content-layout');

  const showLoading = () => {
    if (loader) loader.classList.remove('hidden');
    if (contentLayout) contentLayout.classList.add('hidden');
    if (errorPanel) errorPanel.classList.add('hidden');
  };

  const showContent = () => {
    if (loader) loader.classList.add('hidden');
    if (contentLayout) contentLayout.classList.remove('hidden');
    if (errorPanel) errorPanel.classList.add('hidden');
  };

  const showError = (msg) => {
    if (loader) loader.classList.add('hidden');
    if (contentLayout) contentLayout.classList.add('hidden');
    if (errorPanel) {
      errorPanel.classList.remove('hidden');
      const text = errorPanel.querySelector('p');
      if (text) text.textContent = msg || 'Failed to sync solar planetary arrays.';
    }
  };

  // Wire retry button
  const retryBtn = document.getElementById('planets-retry-btn');
  if (retryBtn) {
    retryBtn.onclick = () => {
      playSynthSound('click');
      initPlanetsController();
    };
  }

  showLoading();

  try {
    const data = await fetchSolarSystemPlanets();
    if (!data || !data.bodies || data.bodies.length === 0) {
      showError('Celestial database returned empty telemetry packets.');
      return;
    }

    // Map French API response to clean English profiles with beautiful colors & specs
    const planetMeta = {
      'mercure': { englishName: 'MERCURY', index: 1, color: '#8a95a5', glow: 'rgba(138, 149, 165, 0.4)', desc: 'Mercury is the smallest planet in our Solar System and closest to the Sun, with extreme surface temperature variations.', discoveredBy: 'ANCIENT SUMERIANS' },
      'venus': { englishName: 'VENUS', index: 2, color: '#e3b85a', glow: 'rgba(227, 184, 90, 0.4)', desc: 'Venus is the second planet from the Sun, wrapped in a suffocating greenhouse haze of carbon dioxide and sulfuric clouds.', discoveredBy: 'ANCIENT OBSERVATIONS' },
      'terre': { englishName: 'EARTH', index: 3, color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)', desc: 'Earth is our home—the third planet from the Sun, and the only astronomical sphere known to harbor rich biological life.', discoveredBy: 'HUMANKIND' },
      'mars': { englishName: 'MARS', index: 4, color: '#ef4444', glow: 'rgba(239, 68, 68, 0.4)', desc: 'Mars is a freezing, barren iron-rich desert world with a thin CO2 atmosphere and active dust storms.', discoveredBy: 'ANCIENT EGYPTIANS' },
      'jupiter': { englishName: 'JUPITER', index: 5, color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)', desc: 'Jupiter is a massive gas giant, heavier than all other planets combined, styled by colorful bands and the Great Red Spot.', discoveredBy: 'ANCIENT BABYLONIANS' },
      'saturne': { englishName: 'SATURN', index: 6, color: '#eab308', glow: 'rgba(234, 179, 8, 0.4)', desc: 'Saturn is the crowned jewel of the solar system, famous for its grand ring network of rock and cosmic ice shards.', discoveredBy: 'ANCIENT TIMES' },
      'uranus': { englishName: 'URANUS', index: 7, color: '#06b6d4', glow: 'rgba(6, 182, 212, 0.4)', desc: 'Uranus is an ice giant tilting almost 98 degrees on its axis, rolling through space on its side.', discoveredBy: 'WILLIAM HERSCHEL (1781)' },
      'neptune': { englishName: 'NEPTUNE', index: 8, color: '#38bdf8', glow: 'rgba(56, 189, 248, 0.4)', desc: 'Neptune is the most distant gas planet, swept by supersonic winds and cold methane storm systems.', discoveredBy: 'URBAIN LE VERRIER (1846)' }
    };

    const listContainer = document.getElementById('planet-selection-list');
    if (listContainer) {
      listContainer.innerHTML = data.bodies.map(body => {
        const meta = planetMeta[body.id] || { englishName: body.englishName.toUpperCase(), color: '#7b61ff', desc: 'No description.', discoveredBy: 'UNKNOWN' };
        // Astronomical Units: semimajorAxis is in km
        const auDist = (body.semimajorAxis / 149597870.7).toFixed(2);
        return `
          <button class="planet-item" data-id="${body.id}" id="planet-btn-${body.id}">
            <div class="planet-item-left">
              <div class="planet-mini-orb" style="--planet-color: ${meta.color}"></div>
              <span class="planet-item-name">${meta.englishName}</span>
            </div>
            <span class="planet-item-distance">${auDist} AU</span>
          </button>
        `;
      }).join('');
    }

    // Detail rendering helper
    function updatePlanetDetails(body) {
      const meta = planetMeta[body.id] || { englishName: body.englishName.toUpperCase(), index: 0, color: '#7b61ff', glow: 'rgba(123,97,255,0.4)', desc: '', discoveredBy: 'UNKNOWN' };

      // Update sphere visuals dynamically
      const sphere = document.getElementById('planet-visual-sphere');
      const glow = document.getElementById('planet-visual-glow');
      if (sphere) {
        sphere.style.setProperty('--planet-color', meta.color);
        sphere.style.setProperty('--planet-color-glow', meta.glow);
        sphere.style.background = `radial-gradient(circle at 30% 30%, ${meta.color} 0%, #03040a 100%)`;
      }
      if (glow) {
        glow.style.setProperty('--planet-color', meta.color);
      }

      // Title & description updates
      const nameTitle = document.getElementById('planet-name-title');
      const idxVal = document.getElementById('planet-index-val');
      const discVal = document.getElementById('planet-discovered-by');
      const quickDesc = document.getElementById('planet-quick-desc');

      if (nameTitle) nameTitle.textContent = meta.englishName;
      if (idxVal) idxVal.textContent = `PLANET #${meta.index}`;
      if (discVal) discVal.textContent = `DISCOVERED: ${meta.discoveredBy}`;
      if (quickDesc) quickDesc.textContent = meta.desc || body.englishName;

      // Stats cards
      const axisEl = document.getElementById('planet-stat-axis');
      const axisAuEl = document.getElementById('planet-stat-axis-au');
      const gravityEl = document.getElementById('planet-stat-gravity');
      const gravityRatioEl = document.getElementById('planet-stat-gravity-ratio');
      const orbitEl = document.getElementById('planet-stat-orbit');
      const orbitYearsEl = document.getElementById('planet-stat-orbit-years');
      const rotationEl = document.getElementById('planet-stat-rotation');
      const rotationDirEl = document.getElementById('planet-stat-rotation-dir');
      const radiusEl = document.getElementById('planet-stat-radius');
      const radiusRatioEl = document.getElementById('planet-stat-radius-ratio');
      const moonsEl = document.getElementById('planet-stat-moons');
      const moonsListEl = document.getElementById('planet-stat-moons-list');

      if (axisEl) axisEl.textContent = `${(body.semimajorAxis / 1000000).toFixed(1)}M km`;
      if (axisAuEl) axisAuEl.textContent = `${(body.semimajorAxis / 149597870.7).toFixed(2)} AU`;
      if (gravityEl) gravityEl.textContent = `${body.gravity.toFixed(2)} m/s²`;
      if (gravityRatioEl) gravityRatioEl.textContent = `${(body.gravity / 9.81).toFixed(2)}x Earth G`;
      
      if (orbitEl) orbitEl.textContent = `${parseFloat(body.sideralOrbit).toLocaleString(undefined, { maximumFractionDigits: 1 })} Days`;
      if (orbitYearsEl) orbitYearsEl.textContent = `${(body.sideralOrbit / 365.25).toFixed(2)} Years`;

      const rotValue = Math.abs(parseFloat(body.sideralRotation));
      if (rotationEl) rotationEl.textContent = `${rotValue.toLocaleString(undefined, { maximumFractionDigits: 1 })} Hours`;
      if (rotationDirEl) {
        rotationDirEl.textContent = parseFloat(body.sideralRotation) < 0 ? 'Retrograde rotation' : 'Direct rotation';
      }

      if (radiusEl) radiusEl.textContent = `${parseFloat(body.meanRadius).toLocaleString(undefined, { maximumFractionDigits: 0 })} km`;
      if (radiusRatioEl) radiusRatioEl.textContent = `${(body.meanRadius / 6371).toFixed(2)}x Earth R`;

      const moonCount = body.moons ? body.moons.length : 0;
      if (moonsEl) moonsEl.textContent = `${moonCount} ${moonCount === 1 ? 'Moon' : 'Moons'}`;
      if (moonsListEl) {
        moonsListEl.textContent = moonCount > 0 
          ? body.moons.map(m => m.moon).slice(0, 4).join(', ') + (moonCount > 4 ? '...' : '')
          : 'No natural satellites';
      }

      // Sync simulator acceleration reading
      const simG = document.getElementById('sim-metric-g');
      if (simG) simG.textContent = `${body.gravity.toFixed(2)} m/s²`;

      // Cancel any ongoing drop physics on change
      state.simRunning = false;
      resetDropChamber();
    };

    // Bind selection clicks
    const items = listContainer.querySelectorAll('.planet-item');
    items.forEach(item => {
      item.onclick = () => {
        playSynthSound('click');
        items.forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        const planetId = item.getAttribute('data-id');
        const activeBody = data.bodies.find(b => b.id === planetId);
        if (activeBody) {
          state.selectedPlanetBody = activeBody;
          updatePlanetDetails(activeBody);
        }
      };
    });

    // Default selection: Earth (terre)
    const earthBtn = document.getElementById('planet-btn-terre');
    if (earthBtn) {
      earthBtn.click();
    } else if (items.length > 0) {
      items[0].click();
    }

    // Setup Gravity Simulator controls
    const dropBtn = document.getElementById('sim-drop-btn');
    const resetBtn = document.getElementById('sim-reset-btn');
    const objSelect = document.getElementById('sim-object-select');
    const dropperIcon = document.getElementById('sim-dropper-icon');

    const objIcons = {
      astronaut: 'fa-user-astronaut',
      wrench: 'fa-wrench',
      lander: 'fa-space-shuttle',
      apple: 'fa-apple-whole'
    };

    if (objSelect && dropperIcon) {
      objSelect.onchange = () => {
        playSynthSound('click');
        const val = objSelect.value;
        const iconClass = objIcons[val] || 'fa-cubes';
        dropperIcon.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;
        resetDropChamber();
      };
    }

    function resetDropChamber() {
      state.simRunning = false;
      const timerEl = document.getElementById('sim-metric-time');
      const velEl = document.getElementById('sim-metric-velocity');
      const keEl = document.getElementById('sim-metric-ke');
      
      if (timerEl) timerEl.textContent = '0.00 s';
      if (velEl) velEl.textContent = '0.00 m/s';
      if (keEl) keEl.textContent = '0.00 J';
      if (dropperIcon) dropperIcon.style.top = '10px';

      if (dropBtn) dropBtn.classList.remove('hidden');
      if (resetBtn) resetBtn.classList.add('hidden');
    };

    if (dropBtn) {
      dropBtn.onclick = () => {
        if (!state.selectedPlanetBody) return;
        playSynthSound('success');
        
        const g = state.selectedPlanetBody.gravity;
        const totalTime = Math.sqrt(20 / g); // real physics fall time for 10m height
        
        const massMap = { astronaut: 120, wrench: 1.5, lander: 15000, apple: 0.15 };
        const objVal = objSelect ? objSelect.value : 'astronaut';
        const mass = massMap[objVal] || 1.0;

        const timerEl = document.getElementById('sim-metric-time');
        const velEl = document.getElementById('sim-metric-velocity');
        const keEl = document.getElementById('sim-metric-ke');
        const ripple = document.getElementById('sim-impact-ripple');

        const startTime = performance.now();
        state.simRunning = true;

        if (dropBtn) dropBtn.classList.add('hidden');
        if (resetBtn) resetBtn.classList.remove('hidden');

        function physicsTick(now) {
          if (!state.simRunning) return;

          let elapsed = (now - startTime) / 1000; // in seconds
          if (elapsed >= totalTime) {
            elapsed = totalTime;
            state.simRunning = false;

            const finalVel = g * totalTime; // v = g * t
            const finalKe = 0.5 * mass * finalVel * finalVel; // KE = 0.5 * m * v^2

            if (timerEl) timerEl.textContent = `${totalTime.toFixed(2)} s`;
            if (velEl) velEl.textContent = `${finalVel.toFixed(2)} m/s`;
            if (keEl) keEl.textContent = `${finalKe.toLocaleString(undefined, { maximumFractionDigits: 1 })} J`;
            if (dropperIcon) dropperIcon.style.top = 'calc(100% - 30px)';

            // Trigger ripple splash
            if (ripple) {
              ripple.classList.add('impact-active');
              playSynthSound('success');
              setTimeout(() => {
                ripple.classList.remove('impact-active');
              }, 400);
            }
            return;
          }

          // Calculate current stats
          const currentVel = g * elapsed;
          const currentKe = 0.5 * mass * currentVel * currentVel;
          const percentFallen = (0.5 * g * elapsed * elapsed) / 10; // fall distance ratio

          if (dropperIcon) {
            // Position top goes from 10px to roughly 85% depth of chamber
            dropperIcon.style.top = `calc(10px + ${Math.min(percentFallen * 85, 85)}%)`;
          }

          if (timerEl) timerEl.textContent = `${elapsed.toFixed(2)} s`;
          if (velEl) velEl.textContent = `${currentVel.toFixed(2)} m/s`;
          if (keEl) keEl.textContent = `${currentKe.toLocaleString(undefined, { maximumFractionDigits: 1 })} J`;

          requestAnimationFrame(physicsTick);
        }

        requestAnimationFrame(physicsTick);
      };
    }

    if (resetBtn) {
      resetBtn.onclick = () => {
        playSynthSound('click');
        resetDropChamber();
      };
    }

    showContent();

  } catch (error) {
    console.error('Planet explorer setup failure:', error);
    showError('Orbital telemetry line alignment failed. System is offline.');
  }
}

/**
 * 7. Astronomical Events Controller
 */
function initEventsController() {
  const view = document.getElementById('view-events');
  if (!view) return;

  // ── Curated 2025-2026 Astronomical Events Dataset ──────────────────────────
  const EVENTS = [
    {
      id: 'total-lunar-eclipse-mar25',
      type: 'lunar-eclipse',
      label: 'LUNAR ECLIPSE',
      icon: 'fa-circle-half-stroke',
      color: '#ff5d73',
      glow: 'rgba(255,93,115,0.35)',
      name: 'Total Lunar Eclipse',
      date: new Date('2025-03-14T06:58:00Z'),
      visibility: 'Americas, Europe, Africa',
      description: 'The Moon passes completely through Earth\'s umbral shadow, turning a deep blood-red — a phenomenon called the "Blood Moon". This full eclipse lasts approximately 65 minutes.',
      magnitude: 1.178,
      tags: ['Eclipse', 'Moon', 'Blood Moon']
    },
    {
      id: 'partial-solar-eclipse-mar25',
      type: 'solar-eclipse',
      label: 'SOLAR ECLIPSE',
      icon: 'fa-sun',
      color: '#ffd166',
      glow: 'rgba(255,209,102,0.35)',
      name: 'Partial Solar Eclipse',
      date: new Date('2025-03-29T10:48:00Z'),
      visibility: 'Europe, North Africa, North America',
      description: 'The Moon partially obscures the Sun, casting a crescent shadow across northern Europe and parts of North America. Maximum coverage reaches up to 93% in Iceland.',
      magnitude: 0.938,
      tags: ['Eclipse', 'Sun']
    },
    {
      id: 'pink-moon-apr25',
      type: 'moon-event',
      label: 'FULL MOON',
      icon: 'fa-moon',
      color: '#f472b6',
      glow: 'rgba(244,114,182,0.35)',
      name: 'Pink Moon',
      date: new Date('2025-04-13T00:22:00Z'),
      visibility: 'Worldwide',
      description: 'April\'s full moon is called the Pink Moon, named after the pink wildflower phlox which blooms in early spring. It rises brilliantly in the east around sunset.',
      magnitude: null,
      tags: ['Full Moon', 'Named Moon']
    },
    {
      id: 'flower-moon-may25',
      type: 'moon-event',
      label: 'FULL MOON',
      icon: 'fa-moon',
      color: '#f472b6',
      glow: 'rgba(244,114,182,0.35)',
      name: 'Flower Moon',
      date: new Date('2025-05-12T16:56:00Z'),
      visibility: 'Worldwide',
      description: 'May\'s full moon, named after the abundance of wildflowers that bloom this time of year across North America. Also called the Corn Planting or Milk Moon.',
      magnitude: null,
      tags: ['Full Moon', 'Named Moon']
    },
    {
      id: 'strawberry-moon-jun25',
      type: 'moon-event',
      label: 'FULL MOON',
      icon: 'fa-moon',
      color: '#f472b6',
      glow: 'rgba(244,114,182,0.35)',
      name: 'Strawberry Moon',
      date: new Date('2025-06-11T07:44:00Z'),
      visibility: 'Worldwide',
      description: 'June\'s full moon coincides with strawberry harvesting season. It often appears amber or orange near the horizon due to the low angle of the summer sky.',
      magnitude: null,
      tags: ['Full Moon', 'Named Moon']
    },
    {
      id: 'summer-solstice-jun25',
      type: 'solstice',
      label: 'SOLSTICE',
      icon: 'fa-sun',
      color: '#fbbf24',
      glow: 'rgba(251,191,36,0.35)',
      name: 'Summer Solstice',
      date: new Date('2025-06-21T02:42:00Z'),
      visibility: 'Northern Hemisphere',
      description: 'The longest day of the year in the Northern Hemisphere. The Sun reaches its highest point in the sky, marking the official start of astronomical summer and the peak of solar energy.',
      magnitude: null,
      tags: ['Season', 'Solstice']
    },
    {
      id: 'perseids-aug25',
      type: 'meteor-shower',
      label: 'METEOR SHOWER',
      icon: 'fa-meteor',
      color: '#a78bfa',
      glow: 'rgba(167,139,250,0.35)',
      name: 'Perseids Meteor Shower',
      date: new Date('2025-08-12T02:00:00Z'),
      visibility: 'Northern Hemisphere (Best view)',
      description: 'One of the most spectacular annual meteor showers, producing up to 100 meteors per hour at peak. Debris from Comet Swift-Tuttle blazes through the atmosphere at 59 km/s.',
      magnitude: null,
      tags: ['Meteors', 'Comet Swift-Tuttle']
    },
    {
      id: 'buck-moon-jul25',
      type: 'moon-event',
      label: 'SUPERMOON',
      icon: 'fa-moon',
      color: '#34d399',
      glow: 'rgba(52,211,153,0.35)',
      name: 'Buck Supermoon',
      date: new Date('2025-07-10T20:37:00Z'),
      visibility: 'Worldwide',
      description: 'July\'s full moon is a Supermoon — appearing up to 14% larger and 30% brighter than a typical full moon. Named after the period when male deer grow their antlers.',
      magnitude: null,
      tags: ['Full Moon', 'Supermoon', 'Named Moon']
    },
    {
      id: 'penumbral-lunar-eclipse-sep25',
      type: 'lunar-eclipse',
      label: 'LUNAR ECLIPSE',
      icon: 'fa-circle-half-stroke',
      color: '#ff5d73',
      glow: 'rgba(255,93,115,0.35)',
      name: 'Total Lunar Eclipse',
      date: new Date('2025-09-07T18:11:00Z'),
      visibility: 'Europe, Africa, Asia, Australia',
      description: 'A total lunar eclipse visible across Europe, Africa, and most of Asia. The Moon enters Earth\'s full shadow for 84 minutes, glowing a striking copper-red colour.',
      magnitude: 1.354,
      tags: ['Eclipse', 'Moon', 'Blood Moon']
    },
    {
      id: 'annular-solar-eclipse-sep25',
      type: 'solar-eclipse',
      label: 'SOLAR ECLIPSE',
      icon: 'fa-sun',
      color: '#ffd166',
      glow: 'rgba(255,209,102,0.35)',
      name: 'Annular Solar Eclipse',
      date: new Date('2025-09-21T19:42:00Z'),
      visibility: 'South Pacific, Antarctica',
      description: 'The Moon covers the centre of the Sun, leaving a brilliant "ring of fire" visible along the path of annularity across the South Pacific and Antarctica.',
      magnitude: 0.948,
      tags: ['Eclipse', 'Sun', 'Ring of Fire']
    },
    {
      id: 'fall-equinox-sep25',
      type: 'solstice',
      label: 'EQUINOX',
      icon: 'fa-sun',
      color: '#fbbf24',
      glow: 'rgba(251,191,36,0.35)',
      name: 'Autumnal Equinox',
      date: new Date('2025-09-22T19:19:00Z'),
      visibility: 'Northern Hemisphere',
      description: 'Day and night are nearly equal in length worldwide. Marks the official start of autumn in the Northern Hemisphere as the Sun crosses the celestial equator southward.',
      magnitude: null,
      tags: ['Season', 'Equinox']
    },
    {
      id: 'supermoon-oct25',
      type: 'moon-event',
      label: 'SUPERMOON',
      icon: 'fa-moon',
      color: '#34d399',
      glow: 'rgba(52,211,153,0.35)',
      name: "Hunter's Supermoon",
      date: new Date('2025-10-07T03:48:00Z'),
      visibility: 'Worldwide',
      description: 'October\'s full moon occurs near perigee, making it a Supermoon. Traditionally called the Hunter\'s Moon as it provided light for hunters preparing for winter.',
      magnitude: null,
      tags: ['Full Moon', 'Supermoon', 'Named Moon']
    },
    {
      id: 'leonids-nov25',
      type: 'meteor-shower',
      label: 'METEOR SHOWER',
      icon: 'fa-meteor',
      color: '#a78bfa',
      glow: 'rgba(167,139,250,0.35)',
      name: 'Leonids Meteor Shower',
      date: new Date('2025-11-17T05:00:00Z'),
      visibility: 'Worldwide',
      description: 'The Leonids produce fast, bright meteors radiating from Leo. Associated with Comet Tempel-Tuttle, this shower can produce up to 15 meteors per hour under dark skies.',
      magnitude: null,
      tags: ['Meteors', 'Comet Tempel-Tuttle']
    },
    {
      id: 'geminids-dec25',
      type: 'meteor-shower',
      label: 'METEOR SHOWER',
      icon: 'fa-meteor',
      color: '#a78bfa',
      glow: 'rgba(167,139,250,0.35)',
      name: 'Geminids Meteor Shower',
      date: new Date('2025-12-13T05:00:00Z'),
      visibility: 'Worldwide (Best in Northern Hemisphere)',
      description: 'The most prolific meteor shower of the year, producing up to 150 multicoloured meteors per hour. Uniquely originates from asteroid 3200 Phaethon rather than a comet.',
      magnitude: null,
      tags: ['Meteors', 'Asteroid Phaethon']
    },
    {
      id: 'winter-solstice-dec25',
      type: 'solstice',
      label: 'SOLSTICE',
      icon: 'fa-sun',
      color: '#fbbf24',
      glow: 'rgba(251,191,36,0.35)',
      name: 'Winter Solstice',
      date: new Date('2025-12-21T15:03:00Z'),
      visibility: 'Northern Hemisphere',
      description: 'The shortest day and longest night of the year in the Northern Hemisphere. The Sun reaches its lowest point in the sky, marking the official start of astronomical winter.',
      magnitude: null,
      tags: ['Season', 'Solstice']
    },
    {
      id: 'total-solar-eclipse-aug26',
      type: 'solar-eclipse',
      label: 'TOTAL SOLAR ECLIPSE',
      icon: 'fa-sun',
      color: '#ffd166',
      glow: 'rgba(255,209,102,0.35)',
      name: 'Total Solar Eclipse',
      date: new Date('2026-08-12T17:46:00Z'),
      visibility: 'Arctic, Greenland, Iceland, Spain',
      description: 'A rare total solar eclipse. Totality lasts up to 2 minutes 18 seconds across its narrow path. The Sun\'s corona will be spectacularly visible during totality.',
      magnitude: 1.072,
      tags: ['Eclipse', 'Sun', 'Total Eclipse']
    },
    {
      id: 'blue-moon-may26',
      type: 'moon-event',
      label: 'BLUE MOON',
      icon: 'fa-moon',
      color: '#60a5fa',
      glow: 'rgba(96,165,250,0.35)',
      name: 'Blue Moon',
      date: new Date('2026-05-31T08:45:00Z'),
      visibility: 'Worldwide',
      description: 'The rare "Blue Moon" — the second full moon in a single calendar month (May 2026). This phenomenon occurs roughly once every 2-3 years, giving rise to the phrase "once in a blue moon".',
      magnitude: null,
      tags: ['Full Moon', 'Blue Moon', 'Rare']
    },
    {
      id: 'perseids-aug26',
      type: 'meteor-shower',
      label: 'METEOR SHOWER',
      icon: 'fa-meteor',
      color: '#a78bfa',
      glow: 'rgba(167,139,250,0.35)',
      name: 'Perseids Meteor Shower 2026',
      date: new Date('2026-08-11T02:00:00Z'),
      visibility: 'Northern Hemisphere (Best view)',
      description: 'Annual return of the Perseids, one of the best meteor showers of the year. In 2026, a thin crescent moon sets early providing exceptional dark-sky viewing conditions.',
      magnitude: null,
      tags: ['Meteors', 'Comet Swift-Tuttle']
    }
  ];

  // ── Filter State ────────────────────────────────────────────────────────────
  let activeFilter = 'all';
  const filters = [
    { id: 'all', label: 'ALL EVENTS', icon: 'fa-list' },
    { id: 'meteor-shower', label: 'METEOR SHOWERS', icon: 'fa-meteor' },
    { id: 'lunar-eclipse', label: 'LUNAR ECLIPSES', icon: 'fa-circle-half-stroke' },
    { id: 'solar-eclipse', label: 'SOLAR ECLIPSES', icon: 'fa-sun' },
    { id: 'moon-event', label: 'MOON EVENTS', icon: 'fa-moon' },
    { id: 'solstice', label: 'SOLSTICES & EQUINOXES', icon: 'fa-star' }
  ];

  // ── Helper: format countdown ────────────────────────────────────────────────
  function formatCountdown(targetDate) {
    const now = new Date();
    const diff = targetDate - now;
    if (diff <= 0) return { text: 'COMPLETED', past: true };

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 365) {
      const months = Math.floor(days / 30.44);
      return { text: `${months}mo ${days % 30}d`, past: false };
    }
    if (days > 0) return { text: `${days}d ${hours}h ${mins}m`, past: false };
    if (hours > 0) return { text: `${hours}h ${mins}m`, past: false };
    return { text: `${mins}m`, past: false };
  }

  function formatEventDate(date) {
    return date.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  // ── Find next upcoming event ────────────────────────────────────────────────
  const now = new Date();
  const nextEvent = EVENTS.filter(e => e.date > now).sort((a, b) => a.date - b.date)[0];

  // ── Render ──────────────────────────────────────────────────────────────────

  // Render next event banner
  const bannerEl = document.getElementById('events-next-banner');
  if (bannerEl && nextEvent) {
    const cd = formatCountdown(nextEvent.date);
    bannerEl.innerHTML = `
      <div class="next-event-label">NEXT COSMIC EVENT</div>
      <div class="next-event-name">${nextEvent.name}</div>
      <div class="next-event-meta">
        <span class="next-event-countdown" id="events-live-countdown">${cd.text}</span>
        <span class="next-event-date-str">${formatEventDate(nextEvent.date)}</span>
      </div>
    `;
    bannerEl.style.setProperty('--banner-glow', nextEvent.glow);
    bannerEl.style.borderColor = nextEvent.color;
  }

  // Live countdown tick
  if (nextEvent) {
    const cdInterval = setInterval(() => {
      const el = document.getElementById('events-live-countdown');
      if (!el) { clearInterval(cdInterval); return; }
      const cd = formatCountdown(nextEvent.date);
      el.textContent = cd.text;
    }, 60000);
  }

  // Render filter tabs
  const filterBar = document.getElementById('events-filter-bar');
  if (filterBar) {
    filterBar.innerHTML = filters.map(f => `
      <button class="evt-filter-btn ${f.id === activeFilter ? 'active' : ''}" data-filter="${f.id}">
        <i class="fa-solid ${f.icon}"></i>
        <span>${f.label}</span>
      </button>
    `).join('');

    filterBar.querySelectorAll('.evt-filter-btn').forEach(btn => {
      btn.onclick = () => {
        playSynthSound('click');
        activeFilter = btn.dataset.filter;
        filterBar.querySelectorAll('.evt-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderCards();
      };
    });
  }

  // Render event cards
  function renderCards() {
    const grid = document.getElementById('events-cards-grid');
    if (!grid) return;

    const filtered = activeFilter === 'all'
      ? EVENTS
      : EVENTS.filter(e => e.type === activeFilter);

    grid.innerHTML = filtered.map(evt => {
      const cd = formatCountdown(evt.date);
      const isPast = cd.past;
      return `
        <div class="evt-card glass-panel ${isPast ? 'evt-card--past' : ''}" style="--evt-color:${evt.color};--evt-glow:${evt.glow}">
          <div class="evt-card-top">
            <div class="evt-icon-ring" style="background:${evt.glow};border-color:${evt.color}">
              <i class="fa-solid ${evt.icon}" style="color:${evt.color}"></i>
            </div>
            <div class="evt-header-info">
              <span class="evt-type-badge" style="color:${evt.color};border-color:${evt.color}">${evt.label}</span>
              <h3 class="evt-name">${evt.name}</h3>
              <span class="evt-date-str">${formatEventDate(evt.date)}</span>
            </div>
            ${isPast
              ? `<span class="evt-past-badge"><i class="fa-solid fa-check-circle"></i> COMPLETED</span>`
              : `<div class="evt-countdown-pill" style="border-color:${evt.color}">
                   <i class="fa-solid fa-clock" style="color:${evt.color}"></i>
                   <span style="color:${evt.color}">${cd.text}</span>
                 </div>`
            }
          </div>
          <p class="evt-description">${evt.description}</p>
          <div class="evt-card-footer">
            <div class="evt-visibility">
              <i class="fa-solid fa-location-dot" style="color:${evt.color}"></i>
              <span>${evt.visibility}</span>
            </div>
            <div class="evt-tags">
              ${evt.tags.map(t => `<span class="evt-tag">${t}</span>`).join('')}
            </div>
          </div>
          ${evt.magnitude ? `<div class="evt-magnitude-bar">
            <span class="evt-magnitude-label">ECLIPSE MAGNITUDE</span>
            <div class="evt-magnitude-track"><div class="evt-magnitude-fill" style="width:${Math.min(evt.magnitude * 80, 100)}%;background:${evt.color}"></div></div>
            <span class="evt-magnitude-val">${evt.magnitude.toFixed(3)}</span>
          </div>` : ''}
        </div>
      `;
    }).join('');

    // Animate in
    if (typeof gsap !== 'undefined') {
      gsap.from('#events-cards-grid .evt-card', {
        opacity: 0, y: 20, duration: 0.4, stagger: 0.05, ease: 'power2.out'
      });
    }
  }

  renderCards();
}

/**
 * 6. Mission Control Settings Panel Controller
 */
function initSettingsController() {
  const keyInput = document.getElementById('settings-nasa-api-key');
  const toggleVisibility = document.getElementById('settings-toggle-key-visibility');
  const saveBtn = document.getElementById('settings-save-key-btn');

  const audioToggle = document.getElementById('settings-toggle-audio');
  const particlesToggle = document.getElementById('settings-toggle-particles');

  // Load and apply NASA Key from storage
  if (keyInput) {
    keyInput.value = localStorage.getItem('astro-nasa-api-key') || '';
  }

  // Toggle Visibility hookup
  if (toggleVisibility && keyInput) {
    toggleVisibility.onclick = () => {
      playSynthSound('click');
      const isPass = keyInput.type === 'password';
      keyInput.type = isPass ? 'text' : 'password';
      const icon = toggleVisibility.querySelector('i');
      if (icon) {
        icon.className = isPass ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
      }
    };
  }

  // Save Key hookup
  if (saveBtn && keyInput) {
    saveBtn.onclick = () => {
      playSynthSound('success');
      const keyVal = keyInput.value.trim();
      if (keyVal) {
        localStorage.setItem('astro-nasa-api-key', keyVal);
        showToast('NASA OPEN-DATA API KEY SAVED', 'success');
      } else {
        localStorage.removeItem('astro-nasa-api-key');
        showToast('NASA DEFAULT LINK PROFILE ACTIVE');
      }
    };
  }

  // Audio checkbox synchronisation
  if (audioToggle) {
    audioToggle.checked = state.soundEnabled;
    audioToggle.onchange = () => {
      state.soundEnabled = audioToggle.checked;
      localStorage.setItem('astro-sound', state.soundEnabled);
      if (state.soundEnabled) {
        showToast('MICRO-SYNTH TELEMETRY COMM-LINKED', 'success');
        playSynthSound('success');
      } else {
        showToast('MICRO-SYNTH TELEMETRY MUTED');
      }

      // Synchronise top bar sound button status
      const soundBtn = document.getElementById('sound-toggle-btn');
      if (soundBtn) {
        const icon = soundBtn.querySelector('i');
        if (state.soundEnabled) {
          soundBtn.setAttribute('data-tooltip', 'Mute Telemetry Feedback');
          if (icon) icon.className = 'fa-solid fa-volume-high';
        } else {
          soundBtn.setAttribute('data-tooltip', 'Enable Telemetry Feedback');
          if (icon) icon.className = 'fa-solid fa-volume-xmark';
        }
      }
    };
  }

  // Particles drift checkbox synchronisation — actually pauses/resumes the canvas starfield
  if (particlesToggle) {
    const partActive = localStorage.getItem('astro-particles-drift') !== 'false';
    particlesToggle.checked = partActive;
    // Apply initial state to canvas
    const canvas = document.getElementById('space-canvas');
    if (canvas) canvas.style.opacity = partActive ? '1' : '0.15';

    particlesToggle.onchange = () => {
      playSynthSound('click');
      const enabled = particlesToggle.checked;
      localStorage.setItem('astro-particles-drift', enabled);
      // Dim canvas when particles are disabled
      const cvs = document.getElementById('space-canvas');
      if (cvs) {
        cvs.style.transition = 'opacity 0.6s ease';
        cvs.style.opacity = enabled ? '1' : '0.15';
      }
      // Also toggle nebula glow blobs
      const nebulas = document.querySelectorAll('.cosmic-nebula');
      nebulas.forEach(n => { n.style.transition = 'opacity 0.6s ease'; n.style.opacity = enabled ? '1' : '0'; });
      showToast(enabled ? 'NEBULA STARDUST DRIFT ACCELERATED' : 'NEBULA STARDUST DRIFT FROZEN');
    };
  }

}


/* ==========================================================================
   7. INTERFACE STYLING & SETTINGS DRIVERS
   ========================================================================== */
function initThemeAndSettings() {
  const themeBtn = document.getElementById('theme-toggle-btn');
  const soundBtn = document.getElementById('sound-toggle-btn');
  const menuBtn = document.getElementById('menu-toggle-btn');
  const sidebar = document.getElementById('app-sidebar');

  // Load and apply sound toggle UI status
  if (soundBtn) {
    const icon = soundBtn.querySelector('i');
    if (state.soundEnabled) {
      soundBtn.setAttribute('data-tooltip', 'Mute Telemetry Feedback');
      if (icon) icon.className = 'fa-solid fa-volume-high';
    } else {
      soundBtn.setAttribute('data-tooltip', 'Enable Telemetry Feedback');
      if (icon) icon.className = 'fa-solid fa-volume-xmark';
    }
  }

  // Load and apply theme status
  document.documentElement.setAttribute('data-theme', state.theme);
  if (themeBtn) {
    const icon = themeBtn.querySelector('i');
    if (state.theme === 'light') {
      if (icon) icon.className = 'fa-solid fa-sun';
      themeBtn.style.color = 'var(--accent-2)';
    } else {
      if (icon) icon.className = 'fa-solid fa-moon';
      themeBtn.style.color = 'var(--text-main)';
    }
  }

  // 1. Theme Toggle Event
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const newTheme = state.theme === 'dark' ? 'light' : 'dark';
      state.theme = newTheme;
      localStorage.setItem('astro-theme', newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);
      
      // Toggle Icon
      const icon = themeBtn.querySelector('i');
      if (newTheme === 'light') {
        if (icon) icon.className = 'fa-solid fa-sun';
        themeBtn.style.color = 'var(--accent-2)';
        showToast('SCI-ROOM HIGH CONTRAST SKIN ACTIVATED', 'success');
      } else {
        if (icon) icon.className = 'fa-solid fa-moon';
        themeBtn.style.color = 'var(--text-main)';
        showToast('IMMERSIVE COSMOS DEEP SPACE SKIN ACTIVATED', 'success');
      }

      // Phase 2 Theme Sync for Charts
      if (typeof updateDashboardChartsTheme === 'function') {
        updateDashboardChartsTheme();
      }

      playSynthSound('theme');
    });
  }

  // 2. Sound Toggle Event
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      localStorage.setItem('astro-sound', state.soundEnabled);

      const icon = soundBtn.querySelector('i');
      if (state.soundEnabled) {
        soundBtn.setAttribute('data-tooltip', 'Mute Telemetry Feedback');
        if (icon) icon.className = 'fa-solid fa-volume-high';
        showToast('SONIC TELEMETRY LINKED', 'success');
        playSynthSound('click');
      } else {
        soundBtn.setAttribute('data-tooltip', 'Enable Telemetry Feedback');
        if (icon) icon.className = 'fa-solid fa-volume-xmark';
        showToast('SONIC TELEMETRY MUTED');
      }
    });
  }

  // 3. Mobile Navigation Drawer
  if (menuBtn && sidebar) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar.classList.toggle('mobile-open');
      playSynthSound('click');
    });

    // Close sidebar on outer content click
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('mobile-open') && !sidebar.contains(e.target) && e.target !== menuBtn) {
        sidebar.classList.remove('mobile-open');
      }
    });
  }

  // 4. Command Palette trigger hotkey (Ctrl + K)
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      playSynthSound('click');
      showToast('COMMAND PALETTE DISCONNECTED — Telemetry loaded in Phase 5', 'warning');
    }
  });

  // Footer Link Command Palette Click
  const cmdLink = document.getElementById('cmd-pal-trigger-link');
  if (cmdLink) {
    cmdLink.addEventListener('click', (e) => {
      e.preventDefault();
      playSynthSound('click');
      showToast('COMMAND PALETTE INOPERATIONAL — Calibrating in Phase 5', 'warning');
    });
  }
}

/* ==========================================================================
   8. ROOT EVENT ATTACHMENT & INIT
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  // Setup Background starry overlay
  initStarfield();

  // Setup Dynamic clocks
  initSystemClock();

  // Attach Navigation listeners (Desktop sidebars & Mobile Bottom bars)
  const navTargets = document.querySelectorAll('.sidebar-item-link, .mobile-nav-item');
  navTargets.forEach(target => {
    target.addEventListener('click', (e) => {
      e.preventDefault();
      const pageId = target.getAttribute('data-page');
      if (pageId) {
        window.location.hash = `#/${pageId}`;
      }
    });
  });

  // Setup Phase 2 Dashboard features
  initDashboardControllers();

  // Setup UI elements (Toggles, triggers)
  initThemeAndSettings();

  // ── ROUTER INITIALIZATION ──────────────────────────────────────────────────
  window.addEventListener('hashchange', handleRouting);
  
  // Custom scroll-to listener for landing links to prevent route clashing
  document.querySelectorAll('[data-scroll-to]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const targetId = link.getAttribute('data-scroll-to');
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth' });
      }
      // If mobile hamburger menu is open, close it
      const lnavLinks = document.getElementById('lnav-links');
      const hamburgerBtn = document.getElementById('lnav-hamburger');
      if (lnavLinks && lnavLinks.classList.contains('lnav-links-open')) {
        lnavLinks.classList.remove('lnav-links-open');
        if (hamburgerBtn) {
          hamburgerBtn.querySelector('i').className = 'fa-solid fa-bars';
        }
      }
    });
  });

  // Execute initial routing on load
  handleRouting();
});

// Toast flag to show live database state once
let isDbConnectionToastShown = false;

// Stateful Router & Navigation Handler
async function handleRouting() {
  // Normalize empty hash by redirecting to #/home
  if (!window.location.hash || window.location.hash === '#') {
    window.location.hash = '#/home';
    return;
  }

  const hash = window.location.hash;
  const route = hash.replace('#/', '') || 'home';
  const authRoutes = ['home', 'login', 'signup'];
  
  const user = await getUser();
  
  const screens = {
    landing : document.getElementById('cosmix-landing'),
    login   : document.getElementById('cosmix-login'),
    signup  : document.getElementById('cosmix-signup'),
    splash  : document.getElementById('splash-loader'),
    app     : document.querySelector('.app-container')
  };

  function toggleAuthScreen(name) {
    if (screens.app) screens.app.classList.add('hidden');
    if (screens.splash) screens.splash.classList.add('hidden');
    
    // Map route 'home' to DOM element key 'landing'
    const screenKey = name === 'home' ? 'landing' : name;
    
    Object.keys(screens).forEach(k => {
      if (k === 'app' || k === 'splash') return;
      if (!screens[k]) return;
      if (k === screenKey) {
        screens[k].classList.remove('hidden');
      } else {
        screens[k].classList.add('hidden');
      }
    });
  }

  if (user) {
    // 1. Authenticated user path
    if (authRoutes.includes(route)) {
      // Redirect logged-in user away from landing/auth screens to dashboard
      window.location.hash = '#/dashboard';
      return;
    }
    
    // Hide all auth screens and loader, and display main dashboard layout
    authRoutes.forEach(s => {
      const screenKey = s === 'home' ? 'landing' : s;
      if (screens[screenKey]) screens[screenKey].classList.add('hidden');
    });
    if (screens.splash) screens.splash.classList.add('hidden');
    if (screens.app)    screens.app.classList.remove('hidden');
    
    // Apply user data to sidebar & settings profiles
    _applyUserToProfile(user);
    
    // Validate and navigate inside dashboard views
    const validPages = ['dashboard', 'apod', 'events', 'iss', 'launches', 'planets', 'settings', 'mars', 'earth'];
    const targetPage = validPages.includes(route) ? route : 'dashboard';
    
    // Trigger navigation
    navigateToPage(targetPage);

    // Show connection status toast once per load
    if (!isDbConnectionToastShown) {
      isDbConnectionToastShown = true;
      setTimeout(() => {
        if (isSupabaseConfigured) {
          showToast('Live Database Connected', 'success');
        } else {
          showToast('Running in Demo Mode (localStorage)', 'info');
        }
      }, 2000);
    }
  } else {
    // 2. Unauthenticated user path
    if (!authRoutes.includes(route)) {
      // Redirect anonymous users trying to access dashboard views to landing page
      window.location.hash = '#/home';
      return;
    }
    
    // Initialize auth flow controllers if not done
    initAuthFlow();
    
    // Show corresponding auth screen
    toggleAuthScreen(route);
  }
}

/** Apply logged-in user info to sidebar profile area & settings panel */
function _applyUserToProfile(user) {
  const avatarEl = document.querySelector('.avatar-wrapper span');
  const nameEl   = document.querySelector('.user-name');
  const roleEl   = document.querySelector('.user-role');
  if (avatarEl) avatarEl.textContent = user.initials || 'CX';
  if (nameEl)   nameEl.textContent   = user.name || 'Commander';
  if (roleEl)   roleEl.textContent   = user.email || 'SYSTEM DIRECTOR';

  // Apply to settings panel if elements are ready
  const setAvatar = document.getElementById('settings-profile-avatar');
  const setName   = document.getElementById('settings-profile-name');
  const setEmail  = document.getElementById('settings-profile-email');
  if (setAvatar) setAvatar.textContent = user.initials || 'CX';
  if (setName)   setName.textContent   = user.name || 'Commander';
  if (setEmail)  setEmail.textContent  = user.email || '';
}

let isAuthFlowInitialized = false;

/** Wire up all landing / login / signup screen interactions */
function initAuthFlow() {
  if (isAuthFlowInitialized) return;
  isAuthFlowInitialized = true;

  const screens = {
    landing : document.getElementById('cosmix-landing'),
    login   : document.getElementById('cosmix-login'),
    signup  : document.getElementById('cosmix-signup'),
    splash  : document.getElementById('splash-loader'),
    app     : document.querySelector('.app-container')
  };

  // ── Landing page brand click ─────────────────────────────────────────────
  document.querySelector('.lnav-brand')?.addEventListener('click', () => {
    playSynthSound('click');
    window.location.hash = '#/home';
    const landingPage = document.getElementById('cosmix-landing');
    if (landingPage) landingPage.scrollTop = 0;
  });

  // ── Landing page buttons ─────────────────────────────────────────────────
  document.getElementById('landing-signin-btn')?.addEventListener('click', () => {
    playSynthSound('click');
    window.location.hash = '#/login';
  });
  document.getElementById('landing-signup-btn')?.addEventListener('click', () => {
    playSynthSound('click');
    window.location.hash = '#/signup';
  });
  // Hero section CTAs
  document.getElementById('lp-signup-hero')?.addEventListener('click', () => {
    playSynthSound('click');
    window.location.hash = '#/signup';
  });
  document.getElementById('lp-signin-hero')?.addEventListener('click', () => {
    playSynthSound('click');
    window.location.hash = '#/login';
  });
  // Bottom CTA section
  document.getElementById('landing-cta-signup')?.addEventListener('click', () => {
    playSynthSound('click');
    window.location.hash = '#/signup';
  });
  document.getElementById('landing-cta-signin')?.addEventListener('click', () => {
    playSynthSound('click');
    window.location.hash = '#/login';
  });

  // ── Hamburger mobile menu ────────────────────────────────────────────────
  const hamburgerBtn = document.getElementById('lnav-hamburger');
  const lnavLinks    = document.getElementById('lnav-links');
  if (hamburgerBtn && lnavLinks) {
    hamburgerBtn.addEventListener('click', () => {
      lnavLinks.classList.toggle('lnav-links-open');
      const icon = hamburgerBtn.querySelector('i');
      icon.className = lnavLinks.classList.contains('lnav-links-open')
        ? 'fa-solid fa-xmark'
        : 'fa-solid fa-bars';
    });
  }

  // ── Login ↔ Signup links ──────────────────────────────────────────────────
  document.getElementById('go-to-signup')?.addEventListener('click', e => {
    e.preventDefault();
    playSynthSound('click');
    window.location.hash = '#/signup';
  });
  document.getElementById('go-to-login')?.addEventListener('click', e => {
    e.preventDefault();
    playSynthSound('click');
    window.location.hash = '#/login';
  });
  document.getElementById('login-back-landing')?.addEventListener('click', e => {
    e.preventDefault();
    playSynthSound('click');
    window.location.hash = '#/home';
  });
  document.getElementById('signup-back-landing')?.addEventListener('click', e => {
    e.preventDefault();
    playSynthSound('click');
    window.location.hash = '#/home';
  });

  // ── Password show/hide toggles ────────────────────────────────────────────
  function wireEye(btnId, inputId) {
    const btn   = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.querySelector('i').className = `fa-solid ${show ? 'fa-eye-slash' : 'fa-eye'}`;
    });
  }
  wireEye('login-eye-btn', 'login-password');
  wireEye('signup-eye-btn', 'signup-password');
  wireEye('signup-nasa-eye-btn', 'signup-nasa-key');

  // ── Auth error display ────────────────────────────────────────────────────
  function showError(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    if (typeof gsap !== 'undefined') gsap.from(el, { opacity: 0, y: -6, duration: 0.25 });
  }
  function clearError(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  }

  function launchApp(user) {
    _applyUserToProfile(user);
    showToast(`WELCOME, ${user.name.toUpperCase()}`, 'success');
    
    // Fade out current auth screen, then load app
    const activeScreen = document.querySelector('.cosmix-auth-screen:not(.hidden)');
    if (activeScreen && typeof gsap !== 'undefined') {
      gsap.to(activeScreen, { opacity: 0, duration: 0.4, onComplete: () => {
        activeScreen.classList.add('hidden');
        activeScreen.style.opacity = '';
        window.location.hash = '#/dashboard';
      }});
    } else {
      if (activeScreen) activeScreen.classList.add('hidden');
      window.location.hash = '#/dashboard';
    }
  }

  // ── Login submit ──────────────────────────────────────────────────────────
  const loginBtn = document.getElementById('login-submit-btn');
  if (loginBtn) {
    const doLogin = async () => {
      loginBtn.disabled = true;
      loginBtn.style.opacity = '0.6';
      clearError('login-error');
      const email = document.getElementById('login-email')?.value.trim();
      const pass  = document.getElementById('login-password')?.value;
      
      const result = await loginUser(email, pass);
      loginBtn.disabled = false;
      loginBtn.style.opacity = '1';
      if (result.success) {
        playSynthSound('success');
        launchApp(result.user);
      } else {
        playSynthSound('click');
        showError('login-error', result.error);
      }
    };
    loginBtn.addEventListener('click', doLogin);
    // Allow Enter key in password field
    document.getElementById('login-password')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') doLogin();
    });
  }

  // ── Signup submit ─────────────────────────────────────────────────────────
  const signupBtn = document.getElementById('signup-submit-btn');
  if (signupBtn) {
    const doSignup = async () => {
      signupBtn.disabled = true;
      signupBtn.style.opacity = '0.6';
      clearError('signup-error');
      const name    = document.getElementById('signup-name')?.value.trim();
      const email   = document.getElementById('signup-email')?.value.trim();
      const pass    = document.getElementById('signup-password')?.value;
      const confirm = document.getElementById('signup-confirm')?.value;
      const nasaKey = document.getElementById('signup-nasa-key')?.value.trim();
      
      const result  = await registerUser(name, email, pass, confirm);
      signupBtn.disabled = false;
      signupBtn.style.opacity = '1';
      if (result.success) {
        if (nasaKey) {
          localStorage.setItem('astro-nasa-api-key', nasaKey);
          const settingsNasaInput = document.getElementById('settings-nasa-api-key');
          if (settingsNasaInput) {
            settingsNasaInput.value = nasaKey;
          }
        }
        playSynthSound('success');
        launchApp(result.user);
      } else {
        playSynthSound('click');
        showError('signup-error', result.error);
      }
    };
    signupBtn.addEventListener('click', doSignup);
    document.getElementById('signup-confirm')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') doSignup();
    });
    document.getElementById('signup-nasa-key')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') doSignup();
    });
  }
}

// ── Logout Listener System ───────────────────────────────────────────────────
const handleLogout = async () => {
  playSynthSound('click');
  await logoutUser();
  showToast('SESSION TERMINATED', 'info');
  
  // Transition back to auth landing page
  const appContainer = document.querySelector('.app-container');
  const landingPage = document.getElementById('cosmix-landing');
  
  // Ensure landing page is scrolled to top (starts from homepage hero)
  if (landingPage) {
    landingPage.scrollTop = 0;
  }
  
  if (appContainer && typeof gsap !== 'undefined') {
    gsap.to(appContainer, {
      opacity: 0,
      duration: 0.5,
      onComplete: () => {
        appContainer.classList.add('hidden');
        appContainer.style.opacity = '';
        // Reset active state classes for routing
        document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
        document.getElementById('view-dashboard')?.classList.add('active');
        state.activePage = 'dashboard';
        document.querySelectorAll('.sidebar-item-link, .mobile-nav-item').forEach(c => {
          if (c.getAttribute('data-page') === 'dashboard') {
            c.classList.add('active');
          } else {
            c.classList.remove('active');
          }
        });
        // Redirect to homepage hash which triggers the router
        window.location.hash = '#/home';
      }
    });
  } else {
    if (appContainer) appContainer.classList.add('hidden');
    window.location.hash = '#/home';
  }
};

document.getElementById('settings-logout-btn')?.addEventListener('click', handleLogout);
document.getElementById('sidebar-logout-btn')?.addEventListener('click', handleLogout);
document.getElementById('header-logout-btn')?.addEventListener('click', handleLogout);

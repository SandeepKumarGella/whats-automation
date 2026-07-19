/**
 * Requests browser desktop notification permissions.
 */
export const requestNotificationPermission = async (): Promise<void> => {
  if ('Notification' in window) {
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }
};

/**
 * Displays a desktop push notification.
 * @param title - Notification title
 * @param options - Standard notification options
 */
export const showDesktopNotification = (title: string, options: NotificationOptions = {}): void => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      icon: 'https://cdn-icons-png.flaticon.com/512/124/124034.png', // WhatsApp style icon
      ...options
    });
  }
};

/**
 * Programmatically generates a pleasant chime sound using browser Web Audio API.
 * Avoids the need to serve static MP3 files.
 */
export const playNotificationSound = (): void => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    
    // Play a dual-tone pleasant chime
    const playChimeTone = (frequency: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, startTime);
      
      gain.gain.setValueAtTime(0.15, startTime);
      // Exponential decay to make it sound smooth
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // Synthesize a beautiful double chime: C5 (523.25Hz) followed by E5 (659.25Hz)
    const now = ctx.currentTime;
    playChimeTone(523.25, now, 0.35);      // Tone 1
    playChimeTone(659.25, now + 0.15, 0.55); // Tone 2 (offset)

  } catch (error) {
    console.error('Failed to trigger audio synthesis: ', error);
  }
};

App.midi = {};

App.midi.rhythms = {
  Reggaeton: { bpm: 108, pattern: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], instrument: "kick snare hat" },
  Salsa: { bpm: 180, pattern: [1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0], instrument: "congas bongo timbales" },
  Cumbia: { bpm: 104, pattern: [1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1], instrument: "guacharaca bass bombo" },
  Vallenato: { bpm: 120, pattern: [1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0], instrument: "accordion caja guacharaca" },
  Kuduru: { bpm: 140, pattern: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0], instrument: "güiro kazalama bombo" },
  Trap: { bpm: 140, pattern: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], instrument: "808 kick snare hi-hat crash" },
  Rap: { bpm: 90, pattern: [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0], instrument: "boom bap kick snare hat" },
  Hip hop: { bpm: 135, pattern: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0], instrument: "kick snare hat crash" },
  Forro: { bpm: 120, pattern: [1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1], instrument: "sanfona zabumba quadra" },
  Sertanejo: { bpm: 100, pattern: [1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1], instrument: "violão sanfona rabeca" },
  Funk Carioca: { bpm: 128, pattern: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0], instrument: "kick snare hi-hat tamborim" },
  BoomBap: { bpm: 90, pattern: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], instrument: "kick snare closed hat ride" },
  Experimental: { bpm: 110, pattern: [1,0,1,1,0,1,0,0,1,1,0,1,0,1,1,0], instrument: "metallic perc synth bass" },
  Instrumental: { bpm: 120, pattern: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], instrument: "piano strings pads" }
};

App.midi.generate = function(rhythmName) {
  const rhythm = App.midi.rhythms[rhythmName];
  if (!rhythm) return null;
  
  const notes = [];
  const trackCount = 4;
  const ticksPerQuarter = 480;
  const division = 4; // 4/4 time
  
  // Generate MIDI tracks based on pattern
  for (let t = 0; t < trackCount; t++) {
    const track = [];
    const patternLen = rhythm.pattern.length;
    
    for (let i = 0; i < patternLen; i++) {
      if (rhythm.pattern[i] === 1) {
        // Note on - vary note based on track
        const note = 36 + (t * 12 + i % 12) % 12;
        const velocity = 80 + t * 20;
        track.push({ type: 'note_on', note, velocity, tick: 1 });
        track.push({ type: 'note_off', note, velocity, tick: ticksPerQuarter / 16 });
      } else {
        track.push({ type: 'skip', tick: 1 });
      }
    }
    notes.push(track);
  }
  
  return {
    name: rhythmName,
    bpm: rhythm.bpm,
    division,
    ticksPerQuarter,
    trackCount,
    notes
  };
};

App.midi.exportMIDI = function(midiData) {
  if (!midiData) return;
  
  // Build MIDI file binary
  let midi = '';
  // MIDI header
  midi += 'MThd'; // header chunk ID
  midi += String.fromCharCode(0, 0, 0, 6); // chunk length
  midi += String.fromCharCode(0, 1, 0, 1); // format 1, 2 tracks
  midi += String.fromCharCode(0, midiData.ticksPerQuarter); // ticks per quarter
  
  // For each track
  for (let t = 0; t < midiData.trackCount; t++) {
    const events = midiData.notes[t];
    let chunkSize = 2; // for events count
    let data = '';
    
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (ev.type === 'note_on') {
        data += String.fromCharCode(0x90 | 0, ev.note, ev.velocity);
      } else if (ev.type === 'note_off') {
        data += String.fromCharCode(0x80 | 0, ev.note, 0);
      } else if (ev.type === 'skip') {
        data += String.fromCharCode(0);
      }
      chunkSize += data.length;
    }
    
    // Add track chunk
    midi += 'MTrk';
    midi += String.fromCharCode(chunkSize >> 24, (chunkSize >> 16) & 0xFF, (chunkSize >> 8) & 0xFF, chunkSize & 0xFF);
    midi += data;
  }
  
  // Create download link
  const blob = new Blob([midi], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${midiData.name.replace(/\s+/g, '_')}.mid`;
  a.click();
  URL.revokeObjectURL(url);
};

App.midi.render = function (host) {
  host.innerHTML = `
    <div class="midi-container">
      <div class="midi-header">
        <h2>Criador de Arquivos MIDI</h2>
        <p>Genere arquivos MIDI com 14 estilos ritmicos exclusivos</p>
      </div>
      
      <div class="midi-rhythms">
        ${Object.keys(App.midi.rhythms).map(name => `
          <div class="midi-rhythm-card" onclick="App.midi.selectRhythm('${name}')">
            <div class="rhythm-name">${name}</div>
            <div class="rhythm-bpm">BPM: ${App.midi.rhythms[name].bpm}</div>
            <div class="rhythm-pattern">
              ${App.midi.rhythms[name].pattern.map((v, i) => `<span class="dot ${v === 1 ? 'active' : ''}"></span>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>
      
      <div class="midi-actions" style="margin-top:30px;">
        <button class="btn-primary" onclick="App.midi.generateAndExport()">Gerar MIDI Completo</button>
        <button class="btn-ghost" onclick="App.utils.closeModal()">Fechar</button>
      </div>
    </div>
  `;
  
  // Select rhythm for detailed generation
  window.App.midi.selectRhythm = function(name) {
    // Store selected rhythm for export
    window.selectedMidiRhythm = name;
  };
};

App.midi.generateAndExport = function() {
  const name = window.selectedMidiRhythm || 'Instrumental';
  const midiData = App.midi.generate(name);
  if (midiData) {
    App.midi.exportMIDI(midiData);
    App.utils.toast(`MIDI ${name} gerado!`);
  }
};
 (() => {
  "use strict";
  const data = window.STORY_DATA;
  const $ = (selector) => document.querySelector(selector);
  const audio = $("#music");
  const intro = $("#intro");
  const story = $("#story");
  const list = $("#scene-list");
  const ending = $("#ending");
  const player = $("#player");
  const vinyls = document.querySelectorAll(".vinyl-record");
  const seek = $("#seek");
  const currentTime = $("#current-time");
  const durationEl = $("#duration");
  const audioMessage = $("#audio-message");
  let activeScene = -1;
  let started = false;
  let userPaused = false;
  let scrollTimer;
  let lastUserScroll = 0;

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds)) return "0:00";
    const value = Math.max(0, Math.floor(seconds));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
  };
  const sceneAt = (time) => {
    let index = data.scenes.findIndex((scene) => time >= scene.start && (scene.end == null || time < scene.end));
    if (index < 0) {
      // If edits leave a gap, keep the preceding card active until the next start.
      for (let i = data.scenes.length - 1; i >= 0; i -= 1) {
        if (time >= data.scenes[i].start) { index = i; break; }
      }
    }
    return index;
  };

  function buildScenes() {
    list.innerHTML = data.scenes.map((scene, index) => `
      <article class="scene scene-${scene.layout || "hero"}" id="scene-${index}" data-scene="${index}">
        <div class="scene-photo-wrap"><span class="scene-tape" aria-hidden="true"></span><figure class="scene-photo"><img src="${scene.image}" alt="Kenangan ${String(index + 1).padStart(2, "0")}" loading="${index < 2 ? "eager" : "lazy"}" decoding="async"><span class="photo-number">${String(index + 1).padStart(2, "0")} / ${String(data.scenes.length).padStart(2, "0")}</span></figure><span class="photo-spark" aria-hidden="true">✳</span></div>
        <div class="scene-paper"><span class="scene-index">SEBUAH POTONGAN KECIL · ${String(index + 1).padStart(2, "0")}</span><blockquote class="scene-lyric">${scene.lyric || ""}</blockquote><span class="lyric-mark" aria-hidden="true">“</span><p class="scene-caption">${scene.caption || ""}</p><span class="scene-time">${formatTime(scene.start)}</span></div>
      </article>`).join("");
    list.querySelectorAll("img").forEach((img) => img.addEventListener("error", () => {
      img.closest(".scene-photo").classList.add("photo-missing");
      img.remove();
    }, { once: true }));
  }

  function syncScene(force = false) {
    const next = sceneAt(audio.currentTime || 0);
    if (next < 0 || (!force && next === activeScene)) return;
    activeScene = next;
    list.querySelectorAll(".scene").forEach((card, index) => {
      card.classList.toggle("is-active", index === activeScene);
      card.classList.toggle("is-past", index < activeScene);
    });
    if (!started) return;
    const card = $(`#scene-${activeScene}`);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const idle = Date.now() - lastUserScroll > 4200;
    if (card && idle && !userPaused) {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        if (!userPaused && Date.now() - lastUserScroll > 4200) card.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
      }, 350);
    }
  }

  function paintProgress() {
    currentTime.textContent = formatTime(audio.currentTime);
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      seek.max = String(audio.duration);
      if (!seek.matches(":active")) seek.value = String(audio.currentTime);
    }
  }
  function showEnding() {
    vinyls.forEach((vinyl) => vinyl.classList.remove("is-spinning"));
    ending.hidden = false;
    list.classList.add("story-finished");
    setTimeout(() => ending.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" }), 250);
    $("#player-toggle").setAttribute("aria-label", "Putar lagi");
    $(".play-icon").textContent = "▶";
  }
  async function startPlayback() {
    audioMessage.hidden = true;
    try {
      await audio.play();
      userPaused = false;
      started = true;
      intro.classList.add("is-leaving");
      story.classList.add("is-visible");
      player.hidden = false;
      syncScene(true);
      setTimeout(() => story.scrollIntoView({ behavior: "smooth", block: "start" }), 180);
    } catch (error) {
      audioMessage.textContent = "Lagu belum bisa diputar. Periksa file audio, lalu coba lagi.";
      audioMessage.hidden = false;
      console.error("Audio playback failed", error);
    }
  }
  function togglePlayback() {
    if (audio.paused) {
      if (audio.ended) audio.currentTime = 0;
      startPlayback();
    } else {
      audio.pause();
      userPaused = true;
    }
  }

  document.title = data.title;
  $("#intro-title").textContent = data.title;
  $("#intro-note").textContent = data.introNote;
  $("#intro-copy").textContent = data.introCopy;
  $("#story-title").textContent = data.title;
  $("#track-name").textContent = data.trackTitle;
  $("#ending-title").textContent = data.endingTitle;
  $("#ending-copy").textContent = data.endingCopy;
  audio.src = data.audio;
  audio.addEventListener("loadedmetadata", () => {
    durationEl.textContent = formatTime(audio.duration);
    seek.max = String(audio.duration);
    seek.disabled = false;
  });
  audio.addEventListener("timeupdate", () => { paintProgress(); syncScene(); });
  audio.addEventListener("seeked", () => syncScene(true));
  audio.addEventListener("play", () => { userPaused = false; vinyls.forEach((vinyl) => vinyl.classList.add("is-spinning")); $("#player-toggle").setAttribute("aria-label", "Jeda lagu"); $(".play-icon").textContent = "Ⅱ"; });
  audio.addEventListener("pause", () => { userPaused = true; vinyls.forEach((vinyl) => vinyl.classList.remove("is-spinning")); $("#player-toggle").setAttribute("aria-label", "Lanjutkan lagu"); $(".play-icon").textContent = "▶"; });
  audio.addEventListener("ended", showEnding);
  audio.addEventListener("error", () => { audioMessage.textContent = "File lagu tidak ditemukan. Pastikan path di js/story-data.js benar."; audioMessage.hidden = false; });
  seek.addEventListener("input", () => {
    if (Number.isFinite(audio.duration)) {
      audio.currentTime = Number(seek.value);
      if (audio.currentTime < audio.duration - .25) {
        ending.hidden = true;
        list.classList.remove("story-finished");
      }
      paintProgress();
      syncScene(true);
    }
  });
  $("#open-story").addEventListener("click", startPlayback);
  $("#player-toggle").addEventListener("click", togglePlayback);
  $("#replay-story").addEventListener("click", () => { audio.currentTime = 0; ending.hidden = true; list.classList.remove("story-finished"); startPlayback(); });
  function noteManualScroll(event) {
    if (event.target instanceof Element && event.target.closest(".player, button, input, textarea, select")) return;
    lastUserScroll = Date.now();
    clearTimeout(scrollTimer);
  }
  // Track user intent rather than the scroll event itself: scrollIntoView also
  // emits scroll events, and treating those as manual input can stall the story.
  window.addEventListener("wheel", noteManualScroll, { passive: true });
  window.addEventListener("touchmove", noteManualScroll, { passive: true });
  window.addEventListener("keydown", (event) => {
    if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key)) noteManualScroll(event);
  });
  buildScenes();
  // Preload the next image so the scrapbook can transition without waiting.
  data.scenes.slice(0, 2).forEach((scene) => { const image = new Image(); image.src = scene.image; });
})();

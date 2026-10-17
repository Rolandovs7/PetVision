"use strict";

const SIZE = 400;
const HISTORY_KEY = "petvision-history-v1";
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

const elements = {
  video: document.getElementById("video"),
  canvas: document.getElementById("canvas"),
  preview: document.getElementById("foto-preview"),
  placeholder: document.getElementById("placeholder"),
  cameraTag: document.getElementById("camera-tag"),
  upload: document.getElementById("image-upload"),
  startCamera: document.getElementById("start-camera"),
  switchCamera: document.getElementById("switch-camera"),
  classify: document.getElementById("classify"),
  status: document.getElementById("status"),
  resultCard: document.getElementById("result-card"),
  resultIcon: document.getElementById("result-icon"),
  resultLabel: document.getElementById("result-label"),
  resultConfidence: document.getElementById("result-confidence"),
  resultNote: document.getElementById("result-note"),
  pawsDeco: document.getElementById("paws-deco"),
  barDog: document.getElementById("bar-dog"),
  barDogPct: document.getElementById("bar-dog-pct"),
  barCat: document.getElementById("bar-cat"),
  barCatPct: document.getElementById("bar-cat-pct"),
  retry: document.getElementById("retry"),
  dropzone: document.getElementById("dropzone"),
  heroUpload: document.getElementById("hero-upload"),
  heroCamera: document.getElementById("hero-camera"),
  scanningLine: document.getElementById("scanning-line"),
  progressBar: document.getElementById("progress-bar"),
  progressText: document.getElementById("progress-text")
};

let model = null;
let animalDetector = null;
let stream = null;
let facingMode = "environment";
let selectedImage = null;
let previewUrl = null;
let busy = false;

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
  if (elements.video) {
    elements.video.pause();
    elements.video.srcObject = null;
    elements.video.classList.add("hidden");
    elements.video.classList.remove("camera-mirror");
  }
  elements.cameraTag?.classList.add("hidden");
  elements.switchCamera?.classList.add("hidden");
  if (elements.startCamera) elements.startCamera.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle></svg><span>Usar cámara</span>';
}

async function startCamera() {
  if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
    setStatus("Para usar la cámara, abre esta página con HTTPS o localmente.", true);
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus("Este navegador no permite usar la cámara. Sube una foto.", true);
    return;
  }
  stopCamera();
  setStatus("Solicitando permiso para usar la cámara…");
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: facingMode }, width: { ideal: SIZE }, height: { ideal: SIZE } }
    });
    elements.video.srcObject = stream;
    await elements.video.play();
    elements.video.classList.remove("hidden");
    elements.video.classList.toggle("camera-mirror", facingMode === "user");
    elements.preview.classList.add("hidden");
    elements.placeholder.classList.add("hidden");
    elements.cameraTag?.classList.remove("hidden");
    elements.switchCamera?.classList.remove("hidden");
    elements.startCamera.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M15 9l-6 6"></path><path d="M9 9l6 6"></path></svg><span>Detener cámara</span>';
    selectedImage = elements.video;
    resetResult();
    elements.classify.disabled = !model || !animalDetector;
    setStatus(model && animalDetector ? "Cámara lista. Analiza la imagen cuando quieras." : "Cámara lista. Esperando a que carguen los modelos.");
  } catch (error) {
    setStatus("No se pudo iniciar la cámara. Revisa permisos o sube una foto.", true);
    stopCamera();
  }
}

function showSelectedPhoto(file) {
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
    setStatus("Formato no compatible. Usa JPG, PNG, WEBP o GIF.", true);
    elements.upload.value = "";
    return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    setStatus("La imagen supera 12 MB. Elige un archivo más pequeño.", true);
    elements.upload.value = "";
    return;
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    if (!image.naturalWidth || !image.naturalHeight) {
      URL.revokeObjectURL(url);
      setStatus("No pudimos leer esa imagen.", true);
      return;
    }
    stopCamera();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = url;
    selectedImage = image;
    resetResult();
    elements.preview.src = url;
    elements.preview.classList.remove("hidden");
    elements.placeholder.classList.add("hidden");
    elements.classify.disabled = !model || !animalDetector;
    setStatus(model && animalDetector ? "Foto lista. Pulsa «Analizar imagen»." : "Foto lista. Esperando modelos.");
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    setStatus("No pudimos abrir esa imagen.", true);
  };
  image.src = url;
}

function prepareInput(source) {
  const context = elements.canvas.getContext("2d", { willReadFrequently: true });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, SIZE, SIZE);
  if (source === elements.video) {
    const width = source.videoWidth;
    const height = source.videoHeight;
    if (!width || !height) throw new Error("Cámara no lista");
    context.save();
    if (facingMode === "user") {
      context.translate(SIZE, 0);
      context.scale(-1, 1);
    }
    context.drawImage(source, 0, 0, SIZE, SIZE);
    context.restore();
  } else {
    context.drawImage(source, 0, 0, SIZE, SIZE);
  }
}

function resetResult() {
  elements.resultCard.classList.remove("show");
  elements.resultNote.classList.add("hidden");
  elements.pawsDeco.classList.remove("active");
  elements.scanningLine.classList.add("hidden");
  elements.barDog.style.width = "0%";
  elements.barCat.style.width = "0%";
  elements.barDogPct.textContent = "0%";
  elements.barCatPct.textContent = "0%";
  elements.resultIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="4.5" cy="8.5" r="2.5"></circle><circle cx="9" cy="4.5" r="2.5"></circle><circle cx="15" cy="4.5" r="2.5"></circle><circle cx="19.5" cy="8.5" r="2.5"></circle><path d="M17.34 14A5.97 5.97 0 0 0 12 12a5.97 5.97 0 0 0-5.34 2"></path><rect x="6" y="15" width="12" height="4" rx="2"></rect></svg>';
  elements.resultLabel.textContent = "Aún no lo sabemos";
  elements.resultConfidence.textContent = "";
}

function showResult(label, confidence, probDog, probCat) {
  elements.resultIcon.innerHTML = label === "Perro"
    ? '<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5.25a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"></path><path d="M12 8.25v6.5"></path><path d="M8.5 11.75l-1.75 2.75"></path><path d="M15.5 11.75l1.75 2.75"></path><path d="M9 19.25c2 1.5 4 1.5 6 0"></path></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 4.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0Z"></path><path d="M14.5 5.5c2.5 1 3.5 3 3.5 5.5 0 3-2 5.5-5.5 6"></path><path d="M9.5 5.5C7 6.5 6 8.5 6 11c0 3 2 5.5 5.5 6"></path><path d="M7 17.5c1.5 1.5 3.5 2.5 5.5 2.5s4-1 5.5-2.5"></path></svg>';
  elements.resultLabel.textContent = `Es un ${label.toLowerCase()}`;
  elements.resultConfidence.textContent = `${Math.round(confidence * 100)}% de confianza`;
  elements.resultNote.classList.toggle("hidden", confidence >= 0.6);
  elements.barDog.style.width = `${Math.max(0, Math.min(100, probDog * 100))}%`;
  elements.barCat.style.width = `${Math.max(0, Math.min(100, probCat * 100))}%`;
  elements.barDogPct.textContent = `${Math.round(probDog * 100)}%`;
  elements.barCatPct.textContent = `${Math.round(probCat * 100)}%`;
  elements.resultCard.classList.add("show");
  if (confidence >= 0.85) {
    elements.pawsDeco.classList.add("active");
    setTimeout(() => elements.pawsDeco.classList.remove("active"), 1600);
  }
}

async function classify() {
  if (!model || !animalDetector || !selectedImage || busy) return;
  busy = true;
  elements.classify.disabled = true;
  elements.classify.innerHTML = '<svg class="spin" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg><span>Analizando…</span>';
  elements.scanningLine.classList.remove("hidden");
  setStatus("Comprobando que haya una mascota…");
  try {
    prepareInput(selectedImage);
    const detections = await animalDetector.detect(elements.canvas, 20, 0.2);
    const pets = detections.filter((d) => (d.class === "cat" || d.class === "dog") && d.score >= 0.25);
    const personDetected = detections.some((d) => d.class === "person" && d.score >= 0.4);
    if (pets.length === 0) {
      setStatus(personDetected ? "Detectamos una persona, solo clasificamos perros y gatos." : "No detectamos perro ni gato. Prueba otra foto.", true);
      busy = false;
      elements.classify.disabled = false;
      elements.classify.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"></path><path d="M5 6l7-3 7 3"></path><path d="M5 18l7 3 7-3"></path><path d="M5 12l7-3 7 3"></path></svg><span>Analizar imagen</span>';
      elements.scanningLine.classList.add("hidden");
      return;
    }
    setStatus("Analizando mascota…");
    const scaled = document.createElement("canvas");
    scaled.width = 100;
    scaled.height = 100;
    const scaledContext = scaled.getContext("2d", { willReadFrequently: true });
    scaledContext.drawImage(elements.canvas, 0, 0, 100, 100);
    const rgba = scaledContext.getImageData(0, 0, 100, 100).data;
    const grayscale = new Float32Array(10000);
    for (let pixel = 0; pixel < grayscale.length; pixel += 1) {
      const offset = pixel * 4;
      // Match the notebook's COLOR_BGR2GRAY call on the RGB images returned by TensorFlow Datasets.
      grayscale[pixel] = (0.114 * rgba[offset] + 0.587 * rgba[offset + 1] + 0.299 * rgba[offset + 2]) / 255;
    }
    const input = tf.tensor4d(grayscale, [1, 100, 100, 1]);
    const output = model.predict(input);
    const prediction = await output.data();
    if (!Number.isFinite(prediction[0])) throw new Error("El modelo devolvió un resultado inválido.");
    const probDog = prediction[0];
    const probCat = 1 - probDog;
    const label = probDog <= 0.5 ? "Gato" : "Perro";
    const confidence = label === "Gato" ? probCat : probDog;
    input.dispose();
    output.dispose();
    showResult(label, confidence, probDog, probCat);
    try {
      const record = { label, confidence, timestamp: Date.now() };
      const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      const entries = Array.isArray(saved) ? saved : [];
      localStorage.setItem(HISTORY_KEY, JSON.stringify([record, ...entries].slice(0, 20)));
    } catch (e) {}
    setStatus("Listo.");
  } catch (error) {
    console.error(error);
    setStatus("Ocurrió un error al analizar la imagen.", true);
  } finally {
    busy = false;
    elements.classify.disabled = !selectedImage || !model || !animalDetector;
    elements.classify.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"></path><path d="M5 6l7-3 7 3"></path><path d="M5 18l7 3 7-3"></path><path d="M5 12l7-3 7 3"></path></svg><span>Analizar imagen</span>';
    elements.scanningLine.classList.add("hidden");
  }
}

async function loadModel() {
  elements.progressBar.style.width = "10%";
  elements.progressText.textContent = "Cargando el detector de mascotas y el clasificador…";
  try {
    if (!window.tf) throw new Error("No se pudo cargar TensorFlow.js. Comprueba tu conexión e inténtalo de nuevo.");
    if (!window.cocoSsd) throw new Error("No se pudo cargar el detector de mascotas. Comprueba tu conexión e inténtalo de nuevo.");
    const [classifier, detector] = await Promise.all([
      tf.loadLayersModel("./modelo/model.json"),
      cocoSsd.load({ base: "mobilenet_v2" })
    ]);
    model = classifier;
    animalDetector = detector;
    elements.progressBar.style.width = "100%";
    elements.progressText.textContent = "Listo. Funciona sin conexión.";
    elements.classify.disabled = !selectedImage;
    setStatus(selectedImage ? "Modelos cargados. Ya puedes analizar la imagen." : "Modelos cargados. Selecciona una foto o usa la cámara.");
  } catch (error) {
    console.error(error);
    elements.progressBar.style.width = "100%";
    elements.progressText.textContent = "Error cargando los modelos. Recarga la página.";
    setStatus("No se pudieron cargar las comprobaciones de IA. Revisa tu conexión y recarga; no clasificaremos sin validar la imagen.", true);
  }
}

function bindEvents() {
  elements.heroUpload?.addEventListener("click", () => elements.upload.click());
  elements.heroCamera?.addEventListener("click", startCamera);
  elements.upload.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) showSelectedPhoto(e.target.files[0]);
  });
  elements.startCamera.addEventListener("click", () => {
    if (stream) stopCamera();
    else startCamera();
  });
  elements.switchCamera.addEventListener("click", () => {
    facingMode = facingMode === "environment" ? "user" : "environment";
    if (stream) {
      stopCamera();
      startCamera();
    }
  });
  elements.classify.addEventListener("click", classify);
  elements.retry.addEventListener("click", () => {
    resetResult();
    setStatus(selectedImage ? "Foto lista. Pulsa «Analizar imagen»." : "Selecciona una foto o usa la cámara.");
    elements.classify.disabled = !selectedImage || !model || !animalDetector;
    elements.scanningLine.classList.add("hidden");
  });
  elements.dropzone?.addEventListener("click", () => elements.upload.click());
  elements.dropzone?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      elements.upload.click();
    }
  });
  elements.dropzone?.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    elements.dropzone.classList.add("dragover");
  });
  elements.dropzone?.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();
    elements.dropzone.classList.remove("dragover");
  });
  elements.dropzone?.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    elements.dropzone.classList.remove("dragover");
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      showSelectedPhoto(e.dataTransfer.files[0]);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  loadModel();
});

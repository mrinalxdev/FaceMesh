let video;
let faceMesh;
let faces = [];
let particles = [];
let followMouse = false;
let filterMode = 0;
let faceFeatures = [];
let drawMode = 0;
let emotions = [];
let ripples = [];
let audioContext;
let oscillator;
let soundEnabled = false;
let gestureMode = 0;

class Particle {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = createVector(random(-2, 2), random(-2, 2));
    this.size = random(3, 8);
    this.color = color(random(255), random(255), random(255));
    this.lifespan = 255;
    this.rotationSpeed = random(-0.1, 0.1);
    this.angle = random(TWO_PI);
  }

  update(targetX, targetY) {
    let target = createVector(targetX, targetY);
    let force = p5.Vector.sub(target, this.pos);
    force.setMag(0.5);
    this.vel.add(force);
    this.vel.limit(5);
    this.pos.add(this.vel);
    this.lifespan -= 1;
    this.angle += this.rotationSpeed;
  }

  show() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.angle);
    noStroke();
    let c = color(red(this.color), green(this.color), blue(this.color), this.lifespan);
    fill(c);
    rectMode(CENTER);
    rect(0, 0, this.size, this.size);
    pop();
  }

  isDead() {
    return this.lifespan < 0;
  }
}

class Ripple {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.size = 0;
    this.maxSize = random(50, 150);
    this.speed = random(2, 5);
    this.alpha = 255;
  }

  update() {
    this.size += this.speed;
    this.alpha = map(this.size, 0, this.maxSize, 255, 0);
  }

  show() {
    noFill();
    stroke(255, this.alpha);
    circle(this.x, this.y, this.size);
  }

  isDead() {
    return this.size > this.maxSize;
  }
}

function preload() {
  faceMesh = ml5.faceMesh({ maxFaces: 1, flipped: true });
}

function mousePressed() {
  followMouse = !followMouse;
  if (!soundEnabled) initAudio();
}

function initAudio() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  gainNode.gain.value = 0.1;
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start();
  soundEnabled = true;
}

function keyPressed() {
  if (key === 'f') filterMode = (filterMode + 1) % 4;
  if (key === 'd') drawMode = (drawMode + 1) % 4;
  if (key === 'g') gestureMode = (gestureMode + 1) % 3;
  if (key === 's') soundEnabled = !soundEnabled;
}

function detectGesture(face) {
  let leftEye = face.keypoints[159].y;
  let rightEye = face.keypoints[386].y;
  let mouth = face.keypoints[13].y - face.keypoints[14].y;

  if (mouth > 20) return "smile";
  if (leftEye < rightEye - 10) return "wink";
  return "neutral";
}

function gotFaces(results) {
  faces = results;
  if (faces.length > 0) {
    faceFeatures = [
      faces[0].keypoints[1],
      faces[0].keypoints[13],
      faces[0].keypoints[14],
      faces[0].keypoints[33],
      faces[0].keypoints[263],
      faces[0].keypoints[362],
    ];
    emotions.push(detectGesture(faces[0]));
    if (emotions.length > 10) emotions.shift();

    if (soundEnabled) {
      let pitch = map(faces[0].keypoints[1].y, 0, height, 100, 500);
      oscillator.frequency.setValueAtTime(pitch, audioContext.currentTime);
    }
  }
}

function setup() {
  createCanvas(640, 480);
  video = createCapture(VIDEO, { flipped: true });
  video.hide();
  faceMesh.detectStart(video, gotFaces);
  for (let i = 0; i < 100; i++) {
    particles.push(new Particle(random(width), random(height)));
  }
}

function applyVideoFilter() {
  loadPixels();
  for (let i = 0; i < pixels.length; i += 4) {
    if (filterMode === 1) {
      let avg = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
      pixels[i] = avg;
      pixels[i + 1] = avg;
      pixels[i + 2] = avg;
    } else if (filterMode === 2) {
      pixels[i] = 255 - pixels[i];
      pixels[i + 1] = 255 - pixels[i + 1];
      pixels[i + 2] = 255 - pixels[i + 2];
    } else if (filterMode === 3) {
      pixels[i] = pixels[i] * 1.5;
      pixels[i + 1] = pixels[i + 1] * 0.5;
      pixels[i + 2] = pixels[i + 2] * 0.5;
    }
  }
  updatePixels();
}

function drawKaleidoscope(x, y) {
  let segments = 8;
  push();
  translate(x, y);
  for (let i = 0; i < segments; i++) {
    rotate(TWO_PI / segments);
    stroke(255, 100);
    line(0, 0, 50, 0);
  }
  pop();
}

function draw() {
  background(0);
  image(video, 0, 0);
  if (filterMode > 0) applyVideoFilter();

  if (faces.length > 0) {
    if (random(1) < 0.1) {
      ripples.push(new Ripple(faceFeatures[0].x, faceFeatures[0].y));
    }

    if (drawMode === 1) {
      stroke(0, 255, 0);
      noFill();
      beginShape();
      for (let feature of faceFeatures) {
        vertex(feature.x, feature.y);
      }
      endShape(CLOSE);
    } else if (drawMode === 2) {
      for (let feature of faceFeatures) {
        stroke(255, 0, 0);
        line(width/2, height/2, feature.x, feature.y);
      }
    } else if (drawMode === 3) {
      for (let feature of faceFeatures) {
        drawKaleidoscope(feature.x, feature.y);
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      if (particles[i].isDead()) {
        particles.splice(i, 1);
        particles.push(new Particle(random(width), random(height)));
      } else {
        let target = followMouse ? createVector(mouseX, mouseY) : faceFeatures[0];
        particles[i].update(target.x, target.y);
        particles[i].show();
      }
    }

    for (let i = ripples.length - 1; i >= 0; i--) {
      ripples[i].update();
      ripples[i].show();
      if (ripples[i].isDead()) ripples.splice(i, 1);
    }

    if (gestureMode > 0) {
      let currentGesture = emotions[emotions.length - 1];
      textSize(24);
      fill(255);
      text(currentGesture, 10, height - 30);

      if (gestureMode === 2 && currentGesture === "smile") {
        for (let i = 0; i < 5; i++) {
          particles.push(new Particle(random(width), random(height)));
        }
      }
    }
  }

  fill(255);
  noStroke();
  text(`Mode: ${followMouse ? "Mouse" : "Face"} | Filter: ${filterMode} | Draw: ${drawMode} | Gesture: ${gestureMode} | Sound: ${soundEnabled}`, 10, 20);
}

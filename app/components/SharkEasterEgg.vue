<script setup lang="ts">
const isActive = ref(false)
const audio = ref<HTMLAudioElement | null>(null)

onMounted(() => {
  audio.value = new Audio('/SG.mp3')
  audio.value.loop = true
})

// Activer l'easter egg quand le Konami code est entré
useKonamiCode(() => {
  isActive.value = !isActive.value
})

watch(isActive, (val) => {
  if (val) {
    audio.value?.play()
  } else {
    audio.value?.pause()
    if (audio.value) {
      audio.value.currentTime = 0
    }
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="water">
      <div v-if="isActive" class="shark-easter-egg">
        <!-- Vagues -->
        <div class="waves">
          <svg
            class="wave wave-1"
            viewBox="0 0 1440 100"
            preserveAspectRatio="none"
          >
            <path
              d="M0,50 C150,100 350,0 500,50 C650,100 850,0 1000,50 C1150,100 1350,0 1440,50 L1440,100 L0,100 Z"
              fill="currentColor"
            />
          </svg>
          <svg
            class="wave wave-2"
            viewBox="0 0 1440 100"
            preserveAspectRatio="none"
          >
            <path
              d="M0,50 C150,0 350,100 500,50 C650,0 850,100 1000,50 C1150,0 1350,100 1440,50 L1440,100 L0,100 Z"
              fill="currentColor"
            />
          </svg>
        </div>

        <!-- Eau -->
        <div class="water" />

        <!-- Aileron de requin -->
        <div class="shark-fin">
          <svg viewBox="30 20 400 360" class="fin">
            <g transform="scale(-1,1) translate(-460,0)">
              <path
                fill="#f5f5f5"
                d="M349.603 42.768c-31.36-1.053-234.946 205.685-280.595 309.828 26.998-7.923 58.257-15.23 82.4-13.004 22.594 2.083 40.82 15.274 57.844 26.603 17.023 11.33 32.575 20.703 48.654 20.416 16.378-.29 32.196-11.74 49.502-24.862 17.306-13.122 36.175-27.944 60.272-27.812 6.093.033 12.397.946 18.79 2.505-56.174-100.224-21.42-289.766-36.062-293.598-.255-.04-.523-.065-.805-.074z"
              />
            </g>
          </svg>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.shark-easter-egg {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 120px;
  pointer-events: none;
  z-index: 9999;
  overflow: hidden;
}

.waves {
  position: absolute;
  bottom: 60px;
  left: 0;
  right: 0;
  height: 60px;
  z-index: 3;
}

.wave {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 200%;
  height: 100%;
  color: rgba(59, 130, 246, 0.6);
}

.wave-1 {
  animation: wave-move 8s linear infinite;
  opacity: 0.8;
}

.wave-2 {
  animation: wave-move 6s linear infinite reverse;
  opacity: 0.5;
  color: rgba(59, 130, 246, 0.4);
}

@keyframes wave-move {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-50%);
  }
}

.water {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: linear-gradient(
    to bottom,
    rgb(59, 130, 246) 0%,
    rgb(30, 64, 175) 100%
  );
  z-index: 2;
}

.shark-fin {
  position: absolute;
  bottom: 25px;
  z-index: 1;
  left: 0;
  animation: shark-swim 25s linear infinite;
}

.fin {
  width: 80px;
  height: 85px;
  filter: drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.3));
  animation: fin-bob 2s ease-in-out infinite;
}

@keyframes shark-swim {
  0% {
    left: -50px;
    transform: scaleX(1);
  }
  45% {
    left: calc(100% + 10px);
    transform: scaleX(1);
  }
  50% {
    left: calc(100% + 10px);
    transform: scaleX(-1);
  }
  95% {
    left: -50px;
    transform: scaleX(-1);
  }
  100% {
    left: -50px;
    transform: scaleX(1);
  }
}

@keyframes fin-bob {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}

/* Transition d'entrée/sortie */
.water-enter-active {
  transition: all 0.8s ease-out;
}

.water-leave-active {
  transition: all 0.5s ease-in;
}

.water-enter-from {
  transform: translateY(100%);
  opacity: 0;
}

.water-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>

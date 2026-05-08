<script lang="ts">
interface Props {
  src: string;
  albumId: string;
  alt?: string;
}

const { src, albumId, alt = "" }: Props = $props();

let container: HTMLDivElement | undefined = $state();
let canvas: HTMLCanvasElement | undefined = $state();
let visible = $state(false);
let loaded = $state(false);
let error = $state(false);
let animId: number | undefined;

$effect(() => {
  if (!container) return;
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        visible = true;
        observer.disconnect();
      }
    },
    { rootMargin: "200px" }
  );
  observer.observe(container);
  return () => observer.disconnect();
});

$effect(() => {
  if (!visible || !canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = 120;
  const h = 90;
  canvas.width = w;
  canvas.height = h;

  const colors = [
    "rgba(255,255,255,0.5)",
    "rgba(200,200,255,0.4)",
    "rgba(255,200,220,0.4)",
    "rgba(200,255,220,0.3)",
    "rgba(255,240,200,0.4)",
    "rgba(220,200,255,0.4)",
  ];
  const px = 3;
  const cols = Math.ceil(w / px);
  const rows = Math.ceil(h / px);

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (Math.random() > 0.35) {
          ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
          ctx.fillRect(x * px, y * px, px, px);
        }
      }
    }
    animId = requestAnimationFrame(draw);
  }
  draw();

  return () => {
    if (animId !== undefined) cancelAnimationFrame(animId);
  };
});

function onLoad() {
  loaded = true;
}

function onError() {
  error = true;
}
</script>

<div class="break-inside-avoid mb-3" bind:this={container}>
  {#if !visible}
    <div class="skeleton rounded-xl bg-neutral-200 dark:bg-neutral-800 animate-pulse" style="aspect-ratio: 4/3;"></div>
  {:else}
    <div
      data-fancybox={`gallery-${albumId}`}
      data-src={src}
      data-type="image"
      class="block rounded-xl overflow-hidden group cursor-pointer relative"
    >
      {#if !loaded && !error}
        <div class="relative" style="aspect-ratio: 4/3;">
          <canvas bind:this={canvas} class="absolute inset-0 w-full h-full rounded-xl object-cover"></canvas>
          <div class="absolute inset-0 bg-black/5 dark:bg-white/5 rounded-xl"></div>
        </div>
      {/if}

      {#if !error}
        <img
          {src}
          {alt}
          loading="lazy"
          decoding="async"
          onload={onLoad}
          onerror={onError}
          class="w-full h-auto object-cover transition-opacity duration-500 {loaded ? 'opacity-100' : 'opacity-0'} {loaded ? '' : 'absolute inset-0'}"
        />
      {:else}
        <div class="flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 rounded-xl" style="aspect-ratio: 4/3;">
          <svg class="w-8 h-8 text-neutral-300 dark:text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
          </svg>
        </div>
      {/if}
    </div>
  {/if}
</div>

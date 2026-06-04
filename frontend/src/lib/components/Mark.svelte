<!-- Convergence mark — 8 rays pulling inward to a central node -->
<script lang="ts">
  let { size = 26, stroke = 'var(--fg)', accent = 'var(--accent)', weight = 1.8 } = $props();

  const c = 16;
  const ro = 15;
  const ri = 8;
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];

  let pts = $derived(angles.map((deg) => {
    const r = (deg * Math.PI) / 180;
    return {
      x1: c + ro * Math.cos(r),
      y1: c + ro * Math.sin(r),
      x2: c + ri * Math.cos(r),
      y2: c + ri * Math.sin(r),
    };
  }));
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 32 32"
  fill="none"
  style="display: block"
>
  {#each pts as p}
    <line
      x1={p.x1.toFixed(2)}
      y1={p.y1.toFixed(2)}
      x2={p.x2.toFixed(2)}
      y2={p.y2.toFixed(2)}
      {stroke}
      stroke-width={weight}
      stroke-linecap="round"
    />
  {/each}
  <circle cx={c} cy={c} r={2.7} fill={accent} />
</svg>

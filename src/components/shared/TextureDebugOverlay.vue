<script setup lang="ts">
import { ref, computed } from 'vue';
import { textureLog, textureAccessBounce, type TextureLoadEvent } from '../../composables/useTextureBlob';

/**
 * Opt-in on-screen readout of texture loads, for debugging iOS Safari where
 * there's no devtools access. Enable with `?texdebug` (persists to
 * localStorage — Access re-auth strips query strings); disable with
 * `?texdebug=0`. Renders nothing otherwise. Removal = delete this file plus
 * its one-line mount in App.vue.
 */

const enabled = ref(false);
try {
    const params = new URLSearchParams(location.search);
    if (params.has('texdebug')) {
        if (params.get('texdebug') === '0') localStorage.removeItem('texdebug');
        else localStorage.setItem('texdebug', '1');
    }
    enabled.value = localStorage.getItem('texdebug') === '1';
} catch { /* storage unavailable — stay disabled */ }

function fmt(e: TextureLoadEvent): string {
    if (e.outcome === 'summary') return `${e.at} ✓ ${e.note}`;
    const name = e.url.replace(/^\/textures\//, '').replace(/\.webp$/, '');
    const nthTry = e.attempt && e.attempt > 1 ? ` (try ${e.attempt})` : '';
    if (e.outcome === 'cache-hit') return `${e.at} ${name} → cache-hit`;
    if (e.outcome === 'retry') return `${e.at} ${name} ERR ${e.error ?? `status ${e.status}`}${nthTry} → retry`;
    if (e.error) return `${e.at} ${name} ERR ${e.error}${nthTry} → raw`;
    const parts = [e.at, name, e.status ?? '?', e.contentType ?? '?'];
    if (e.bytes != null) parts.push(`${Math.round(e.bytes / 1024)}KB`);
    if (e.redirected != null) parts.push(`red:${e.redirected ? 'y' : 'n'}`);
    if (e.finalOrigin && e.finalOrigin !== location.origin) parts.push(e.finalOrigin);
    if (e.decode) parts.push(`dec:${e.decode}`);
    if (e.cacheControl) parts.push(`[${e.cacheControl}]`);
    parts.push(`→ ${e.outcome === 'blob' ? 'blob' : 'raw'}${nthTry}`);
    return parts.join(' ');
}

const lines = computed(() => textureLog.value.map(fmt));
</script>

<template>
    <Teleport to="body">
        <div v-if="enabled" class="texdebug" aria-hidden="true">
            <div v-if="textureAccessBounce" class="texdebug-bounce">ACCESS BOUNCE — reload to re-auth</div>
            <div v-for="(line, i) in lines" :key="i">{{ line }}</div>
            <div v-if="!lines.length">texdebug on — no texture loads yet</div>
        </div>
    </Teleport>
</template>

<style scoped>
.texdebug {
    position: fixed;
    bottom: 0;
    left: 0;
    z-index: 100;
    max-width: 100vw;
    max-height: 40vh;
    overflow: hidden;
    pointer-events: none;
    background: rgb(0 0 0 / 0.75);
    color: #9f9;
    font-family: monospace;
    font-size: 10px;
    line-height: 1.4;
    padding: 4px 6px;
    white-space: pre-wrap;
    word-break: break-all;
}

.texdebug-bounce {
    color: #f55;
    font-weight: 700;
}
</style>

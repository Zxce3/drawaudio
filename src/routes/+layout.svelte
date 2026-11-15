<script lang="ts">
	import '../app.css';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { onMount } from 'svelte';
	import { initPwa } from '$lib/pwa.svelte';
	import PwaStatus from '$lib/components/app/PwaStatus.svelte';
	
	let { children } = $props();

	onMount(initPwa);
</script>


<Tooltip.Provider delayDuration={300}>
	{@render children()}
</Tooltip.Provider>
<PwaStatus />

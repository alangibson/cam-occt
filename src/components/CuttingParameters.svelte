<script lang="ts">
  import type { CuttingParameters } from '../lib/types';
  
  export let parameters: CuttingParameters = {
    feedRate: 1000,
    pierceHeight: 3.8,
    pierceDelay: 0.5,
    cutHeight: 1.5,
    kerf: 1.5,
    leadInLength: 5,
    leadOutLength: 5
  };
  
  export let units: 'mm' | 'inch' = 'mm';
</script>

<div class="parameters">
  <h3>Cutting Parameters</h3>
  
  <div class="parameter">
    <label for="feedRate">Feed Rate ({units}/min):</label>
    <input
      id="feedRate"
      type="number"
      bind:value={parameters.feedRate}
      min="0"
      step="10"
    />
  </div>
  
  <div class="parameter">
    <label for="pierceHeight">Pierce Height ({units}):</label>
    <input
      id="pierceHeight"
      type="number"
      bind:value={parameters.pierceHeight}
      min="0"
      step="0.1"
    />
  </div>
  
  <div class="parameter">
    <label for="pierceDelay">Pierce Delay (s):</label>
    <input
      id="pierceDelay"
      type="number"
      bind:value={parameters.pierceDelay}
      min="0"
      step="0.1"
    />
  </div>
  
  <div class="parameter">
    <label for="cutHeight">Cut Height ({units}):</label>
    <input
      id="cutHeight"
      type="number"
      bind:value={parameters.cutHeight}
      min="0"
      step="0.1"
    />
  </div>
  
  <div class="parameter">
    <label for="kerf">Kerf Width ({units}):</label>
    <input
      id="kerf"
      type="number"
      bind:value={parameters.kerf}
      min="0"
      step="0.1"
    />
  </div>
  
  <div class="parameter">
    <label for="leadIn">Lead-in Length ({units}):</label>
    <input
      id="leadIn"
      type="number"
      bind:value={parameters.leadInLength}
      min="0"
      step="0.5"
    />
  </div>
  
  <div class="parameter">
    <label for="leadOut">Lead-out Length ({units}):</label>
    <input
      id="leadOut"
      type="number"
      bind:value={parameters.leadOutLength}
      min="0"
      step="0.5"
    />
  </div>
</div>

<style>
  .parameters {
    padding: 1rem;
    background-color: #f9f9f9;
    border-radius: 4px;
  }
  
  h3 {
    margin-top: 0;
    margin-bottom: 1rem;
  }
  
  .parameter {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }
  
  label {
    flex: 1;
    margin-right: 1rem;
  }
  
  input {
    width: 100px;
    padding: 0.25rem;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
</style>
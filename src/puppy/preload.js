let modelPromise;
let gamePromise;

export function preloadPuppyModel() {
  if (!modelPromise) {
    modelPromise = fetch('/models/puppy/dog-rigged.glb', { priority: 'low' })
      .then(response => {
        if (!response.ok) throw new Error(`Puppy model: ${response.status}`);
        return response.arrayBuffer();
      }).catch(error => { modelPromise = undefined; throw error; });
  }
  return modelPromise;
}

export function loadPuppyGame() {
  if (!gamePromise) gamePromise = import('./game.js').catch(error => { gamePromise = undefined; throw error; });
  return gamePromise;
}

export function preloadPuppy() {
  return Promise.all([preloadPuppyModel(), loadPuppyGame()]);
}

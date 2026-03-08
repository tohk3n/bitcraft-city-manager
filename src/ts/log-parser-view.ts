import type { CitizensData } from './types/citizens';

let initialized = false;
function render(cached?: Buildings[]): Promise<CitizensData | null> {
  if (!initialized) {
    await init(container);
  }
}
function init(container:HTMLElement): void{
  renderHusk(container);
  initialized = true;
}
function renderHusk(container: HTMLElement): void{

}


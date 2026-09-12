/** Shared lazy loader for react-data-grid used by both the full sheet
 * note editor and the inline sheet block widget inside markdown notes. */

export interface GridModule {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DataGrid: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderTextEditor: any;
}

let gridModulePromise: Promise<GridModule> | null = null;

export function loadGrid(): Promise<GridModule> {
  if (!gridModulePromise) {
    gridModulePromise = (async () => {
      const mod = await import("react-data-grid");
      // @ts-expect-error - CSS side-effect import has no types
      await import("react-data-grid/lib/styles.css");
      return { DataGrid: mod.DataGrid, renderTextEditor: mod.renderTextEditor };
    })();
  }
  return gridModulePromise;
}

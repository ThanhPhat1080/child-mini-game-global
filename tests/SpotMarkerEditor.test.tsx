import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpotMarkerEditor } from '@/components/admin/SpotMarkerEditor';
import type { Difference } from '@/lib/spot/types';

afterEach(cleanup);

const d = (x: number, y: number, r = 0.06): Difference => ({ x, y, r });

function setup(differences: Difference[] = []) {
  const onChange = vi.fn();
  render(<SpotMarkerEditor srcA="/a.png" srcB="/b.png" differences={differences} onChange={onChange} />);
  const img = screen.getByRole('img', { name: 'Picture A' });
  // a 400 x 300 picture at (100, 50)
  img.getBoundingClientRect = () => ({ left: 100, top: 50, width: 400, height: 300, right: 500, bottom: 350, x: 100, y: 50, toJSON: () => ({}) });
  const clickAt = (fx: number, fy: number) => fireEvent.click(img, { clientX: 100 + fx * 400, clientY: 50 + fy * 300 });
  return { onChange, img, clickAt };
}

describe('SpotMarkerEditor (A15)', () => {
  it('a click on empty space adds a marker with the default radius', () => {
    const { onChange, clickAt } = setup();
    clickAt(0.3, 0.4);
    expect(onChange).toHaveBeenCalledWith([{ x: 0.3, y: 0.4, r: 0.06 }]);
  });

  it('clamps clicks on the border to 0.01-0.99', () => {
    const { onChange, clickAt } = setup();
    clickAt(0, 1);
    expect(onChange).toHaveBeenCalledWith([{ x: 0.01, y: 0.99, r: 0.06 }]);
  });

  it('draws numbered markers and a click on one selects it without adding', () => {
    const { onChange } = setup([d(0.2, 0.2), d(0.6, 0.6)]);
    fireEvent.click(screen.getByRole('button', { name: 'Spot 2' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Spot 2' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Spot 1' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Spot 2' }).textContent).toBe('2');
  });

  it('the Radius slider (4-12 %) changes only the selected marker and clamps', () => {
    const { onChange } = setup([d(0.2, 0.2), d(0.6, 0.6)]);
    fireEvent.click(screen.getByRole('button', { name: 'Spot 2' }));
    const slider = screen.getByLabelText('Radius') as HTMLInputElement;
    expect(slider.min).toBe('4');
    expect(slider.max).toBe('12');
    expect(slider.step).toBe('1');
    expect(slider.value).toBe('6');
    fireEvent.change(slider, { target: { value: '9' } });
    expect(onChange).toHaveBeenLastCalledWith([d(0.2, 0.2), d(0.6, 0.6, 0.09)]);
    fireEvent.change(slider, { target: { value: '30' } });
    expect(onChange).toHaveBeenLastCalledWith([d(0.2, 0.2), d(0.6, 0.6, 0.12)]);
    fireEvent.change(slider, { target: { value: '1' } });
    expect(onChange).toHaveBeenLastCalledWith([d(0.2, 0.2), d(0.6, 0.6, 0.04)]);
  });

  it('Delete spot removes the selected marker', () => {
    const { onChange } = setup([d(0.2, 0.2), d(0.6, 0.6)]);
    fireEvent.click(screen.getByRole('button', { name: 'Spot 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete spot' }));
    expect(onChange).toHaveBeenCalledWith([d(0.6, 0.6)]);
  });

  it('no slider or delete button until a marker is selected', () => {
    setup([d(0.2, 0.2)]);
    expect(screen.queryByLabelText('Radius')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete spot' })).toBeNull();
  });

  it('refuses an 11th marker with a visible message', () => {
    const ten = Array.from({ length: 10 }, (_, i) => d(0.05 + i * 0.09, 0.5));
    const { onChange, clickAt } = setup(ten);
    clickAt(0.5, 0.9);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/at most 10/i);
  });

  it('toggling to B shows picture B with the same markers', () => {
    setup([d(0.2, 0.2), d(0.6, 0.6)]);
    fireEvent.click(screen.getByRole('button', { name: 'Show picture B' }));
    expect((screen.getByRole('img', { name: 'Picture B' }) as HTMLImageElement).getAttribute('src')).toBe('/b.png');
    expect(screen.getByRole('button', { name: 'Spot 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Spot 2' })).toBeTruthy();
  });

  it('clicking picture B adds a marker at the same spot as the click', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Show picture B' }));
    const imgB = screen.getByRole('img', { name: 'Picture B' });
    imgB.getBoundingClientRect = () => ({ left: 100, top: 50, width: 400, height: 300, right: 500, bottom: 350, x: 100, y: 50, toJSON: () => ({}) });
    fireEvent.click(imgB, { clientX: 100 + 0.25 * 400, clientY: 50 + 0.75 * 300 });
    expect(onChange).toHaveBeenCalledWith([{ x: 0.25, y: 0.75, r: 0.06 }]);
  });

  it('uses the current bounding rect at click time', () => {
    const { onChange, img } = setup();
    img.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.click(img, { clientX: 100, clientY: 50 });
    expect(onChange).toHaveBeenCalledWith([{ x: 0.5, y: 0.5, r: 0.06 }]);
  });

  it('warns about small spots (r below 6%), with a correct count, and never for 6%', () => {
    const { unmount } = render(<SpotMarkerEditor srcA="/a.png" srcB="/b.png" differences={[d(0.2, 0.2, 0.05), d(0.5, 0.5, 0.04), d(0.8, 0.8)]} onChange={() => {}} />);
    expect(screen.getByText('2 spots are small and may be hard for a young child to see.')).toBeTruthy();
    unmount();
    const one = render(<SpotMarkerEditor srcA="/a.png" srcB="/b.png" differences={[d(0.2, 0.2, 0.05), d(0.5, 0.5)]} onChange={() => {}} />);
    expect(screen.getByText('1 spot is small and may be hard for a young child to see.')).toBeTruthy();
    one.unmount();
    render(<SpotMarkerEditor srcA="/a.png" srcB="/b.png" differences={[d(0.2, 0.2, 0.06), d(0.5, 0.5, 0.12)]} onChange={() => {}} />);
    expect(screen.queryByText(/small and may be hard/)).toBeNull();
  });
});

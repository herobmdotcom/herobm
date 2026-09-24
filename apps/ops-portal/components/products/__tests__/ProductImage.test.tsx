import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductImage from '../ProductImage';

describe('ProductImage Component', () => {
  it('renders placeholder icon when imagePath is null and hideFallback is false', () => {
    render(<ProductImage imagePath={null} alt="Widget" />);
    expect(screen.getByTitle('Widget')).toBeInTheDocument();
  });

  it('renders nothing when imagePath is null and hideFallback is true', () => {
    const { container } = render(<ProductImage imagePath={null} alt="Widget" hideFallback={true} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders image and opens fullscreen preview on click with X to close', async () => {
    const user = userEvent.setup();

    render(
      <ProductImage
        imagePath="widget-1.png"
        alt="Precision Widget"
        showPreviewOnClick={true}
      />
    );

    const thumbnail = screen.getByAltText('Precision Widget');
    expect(thumbnail).toBeInTheDocument();

    // Click thumbnail to expand
    await user.click(thumbnail);

    // Modal dialog should be open
    const dialog = screen.getByRole('dialog', { name: 'Precision Widget' });
    expect(dialog).toBeInTheDocument();

    // Prominent X close button
    const closeBtn = screen.getByRole('button', { name: 'Close fullscreen image' });
    expect(closeBtn).toBeInTheDocument();

    // Click X to close
    await user.click(closeBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

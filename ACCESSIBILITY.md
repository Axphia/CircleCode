# Accessibility Statement (A11y)

CircleCode is committed to ensuring digital accessibility for people with disabilities. We continually improve the user experience for everyone and apply relevant accessibility standards across our core barcode generator, scanner components, and web applications.

---

## Conformance Standards

This project aims to conform to the **Web Content Accessibility Guidelines (WCAG) 2.1 Level AA** standards and Section 508 accessibility requirements.

---

## 1. Barcode Graphic Accessibility (SVG & Canvas)

Visual barcodes inherently convey information graphically, which presents accessibility barriers to users with visual impairments. CircleCode implements the following features to bridge this gap:

### Semantic SVG Structure
When rendering circular barcodes via `renderToSVG()`, CircleCode ensures accessibility:
- **`role="img"`**: Informs assistive technologies that the `<svg>` represents a graphic element.
- **`<title>` and `<desc>` tags**: Encodes human-readable titles and detailed descriptions of the barcode content.
- **Accessible Text Equivalence**: Screen readers announce the embedded payload text (e.g., `"CircleCode barcode encoding Table-24"`).
- **ARIA Attributes**: `aria-label` or `aria-labelledby` attributes ensure screen readers can announce the decoded content without parsing geometric paths.

```html
<!-- Example of accessible SVG output -->
<svg role="img" aria-label="CircleCode barcode: Table-24" viewBox="-190 -190 380 380">
  <title>CircleCode Barcode: Table-24</title>
  <desc>Circular barcode in Circle mode containing 5 data rings encoding 8 bytes of UTF-8 payload.</desc>
  <!-- Barcode geometry -->
</svg>
```

### High Contrast & Color Independence
- **Luminance Contrast**: Standard black dashes on white backgrounds provide a **21:1 contrast ratio**, far exceeding the WCAG 4.5:1 requirement.
- **Color Perception**: CircleCode encodes data strictly through **geometry, angles, and luminance (dark/light)** rather than color hue. Users with red-green, blue-yellow, or total color blindness can scan and verify barcodes without hindrance.
- **Custom Theming**: When applying brand colors via `dark` and `light` options, developers are strongly advised to maintain a minimum contrast ratio of **4.5:1** against the background.

---

## 2. Web Application & Scanner Accessibility

The interactive web demo and live camera scanner (`index.html`) follow comprehensive accessible design principles:

### Keyboard Navigation & Focus Management
- **Full Keyboard Operability**: All interactive controls (buttons, camera selectors, input fields, and preset pills) can be operated using <kbd>Tab</kbd>, <kbd>Shift</kbd>+<kbd>Tab</kbd>, <kbd>Enter</kbd>, and <kbd>Space</kbd>.
- **Visible Focus Indicators**: High-contrast outline rings (`outline: 2px solid #0071e3; outline-offset: 2px;`) highlight the currently focused interactive element.
- **Logical Tab Sequence**: Interactive tab stops follow the visual reading order (Header → Hero Generator → Preset Controls → Scanner Mode → Documentation).

### Motion Sensitivity (`prefers-reduced-motion`)
The interactive 3D logo coin and animated camera targeting reticle respect the user's OS-level motion preferences:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```
When reduced motion is active:
- Continuous 3D coin rotation is paused.
- Camera viewfinder scanning sweeps and radar pulses are disabled.
- Smooth scrolling is replaced with instantaneous position jumps.

### Screen Reader Support
- **Live Regions (`aria-live="polite"`)**: When a camera scan successfully decodes a barcode, the result is announced via an ARIA live region without interrupting current speech:
  ```html
  <div role="status" aria-live="polite" class="sr-only" id="scanner-announcements"></div>
  ```
- **Form Labels**: All form inputs, sliders (ring count, density), and file upload dropzones have associated `<label>` elements or `aria-label` attributes.
- **Icon Buttons**: Purely visual icons contain `.sr-only` descriptive text or explicit `aria-label` tags.

---

## 3. Best Practices for Implementing CircleCode Accessibly

When embedding CircleCode in your own applications, please follow these guidelines:

1. **Always Provide Text Alternatives**: Never display a CircleCode in isolation without an accompanying text equivalent or human-readable label underneath.
2. **Accessible Modals & Overlays**: If displaying a CircleCode in a pop-up or modal, ensure keyboard focus is trapped within the dialog and <kbd>Esc</kbd> dismisses it.
3. **Sound or Haptic Feedback**: In mobile camera scanning applications, trigger an auditory tone or haptic vibration (`navigator.vibrate(50)`) upon successful scan to assist users who cannot see the screen.

---

## Feedback & Accessibility Issues

We welcome feedback on the accessibility of CircleCode. If you encounter any accessibility barriers or have suggestions for improvement, please report them:

- **GitHub Issues**: [Submit an Issue on GitHub](https://github.com/Axphia/CircleCode/issues)
- **Tag**: Label issues with `accessibility` or `a11y`
- **Expected Information**: Please include the device, browser, assistive technology (e.g. NVDA, VoiceOver, JAWS), and a description of the issue.

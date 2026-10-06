import { describe, test, expect } from 'vitest';
import { markdownAHtml } from '../src/markdown';

describe('vista previa del Markdown', () => {
  test('da formato básico', () => {
    expect(markdownAHtml('## Título\n\nUn **fuerte** y *suave* [enlace](https://a.co).\n\n- uno\n- dos')).toBe(
      '<h3>Título</h3>\n<p>Un <strong>fuerte</strong> y <em>suave</em> <a href="https://a.co" rel="noopener" target="_blank">enlace</a>.</p>\n<ul><li>uno</li><li>dos</li></ul>',
    );
  });
  test('no deja pasar HTML ni enlaces javascript', () => {
    const html = markdownAHtml('<img src=x onerror=alert(1)> [x](javascript:alert(1)) <script>alert(1)</script>');
    expect(html).not.toMatch(/<img|<script|href="javascript/);
    expect(html).toContain('&lt;img');
  });
});

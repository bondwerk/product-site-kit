// Sanitizer mit tel: und rel auf externen Links (Spec #435 §5.1); getestet am Subpath @bondwerk/site-kit/integrationen.
import { describe, expect, it } from 'vitest';
import { sanitizeSchema, rehypeExterneLinks } from '../src/integrationen/index.js';

describe('Sanitizer', () => {
  it('Protokoll-Allowlist: href http/https/mailto/tel, src http/https', () => {
    expect(sanitizeSchema.protocols?.href).toEqual(['http', 'https', 'mailto', 'tel']);
    expect(sanitizeSchema.protocols?.src).toEqual(['http', 'https']);
  });

  it('rehypeExterneLinks setzt target und rel nur an http(s)-Links, auch verschachtelt', () => {
    const baum = { type: 'root', children: [
      { type: 'element', tagName: 'p', properties: {}, children: [
        { type: 'element', tagName: 'a', properties: { href: 'https://fremd.example.ch' }, children: [] },
        { type: 'element', tagName: 'a', properties: { href: '#kontakt' }, children: [] },
        { type: 'element', tagName: 'a', properties: { href: 'mailto:a@b.example.ch' }, children: [] },
      ] },
    ] };
    rehypeExterneLinks()(baum);
    const [extern, anker, mail] = (baum.children[0] as { children: { properties: Record<string, unknown> }[] }).children;
    expect(extern!.properties).toEqual({ href: 'https://fremd.example.ch', target: '_blank', rel: ['noopener', 'noreferrer'] });
    expect(anker!.properties).toEqual({ href: '#kontakt' });
    expect(mail!.properties).toEqual({ href: 'mailto:a@b.example.ch' });
  });
});

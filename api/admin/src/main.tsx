import { render } from 'preact';
import { App } from './app';
import { interceptarEnlaces } from './ruteo';
import './estilos.css';

interceptarEnlaces();
render(<App />, document.getElementById('app')!);

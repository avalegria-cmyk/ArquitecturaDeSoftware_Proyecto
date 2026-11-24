/**
 * Circuit Breaker sencillo (diapositiva de Resiliencia):
 * - Cerrado: las llamadas pasan normalmente.
 * - Abierto: tras 5 fallos seguidos se corta el acceso 15 s y se responde al instante.
 * - Semiabierto: pasado ese tiempo se deja pasar una llamada de prueba.
 */
export class CircuitBreaker {
  private fallos = 0;
  private abiertoHasta = 0;

  constructor(
    readonly nombre: string,
    private readonly umbral = 5,
    private readonly esperaMs = 15_000,
  ) {}

  get estado(): 'cerrado' | 'abierto' | 'semiabierto' {
    if (this.fallos < this.umbral) return 'cerrado';
    return Date.now() < this.abiertoHasta ? 'abierto' : 'semiabierto';
  }

  async ejecutar<T>(operacion: () => Promise<T>): Promise<T> {
    if (this.estado === 'abierto') throw new CircuitoAbierto(this.nombre);
    try {
      const resultado = await operacion();
      this.fallos = 0;
      return resultado;
    } catch (error) {
      this.fallos++;
      if (this.fallos >= this.umbral) this.abiertoHasta = Date.now() + this.esperaMs;
      throw error;
    }
  }
}

export class CircuitoAbierto extends Error {
  constructor(servicio: string) {
    super(`Circuito abierto hacia ${servicio}`);
  }
}

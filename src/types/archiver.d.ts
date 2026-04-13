declare module 'archiver' {
  type ArchiverInstance = {
    on(event: 'warning' | 'error', listener: (error: Error) => void): ArchiverInstance
    pipe(destination: NodeJS.WritableStream): NodeJS.WritableStream
    file(filepath: string, data: { name: string }): ArchiverInstance
    append(source: string | Buffer, data: { name: string }): ArchiverInstance
    finalize(): Promise<void>
  }

  export default function archiver(
    format: 'zip',
    options?: { zlib?: { level?: number } },
  ): ArchiverInstance
}

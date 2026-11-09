declare module 'zkteco-js' {
  type ZKResponse<T> = { data?: T[]; err?: unknown }

  const ZktecoJs: {
    new (ip: string, port: number, timeout?: number, inport?: number): {
      createSocket(): Promise<void>
      disconnect(): Promise<void>
      getInfo(): Promise<{ logCounts?: number; logCapacity?: number; userCounts?: number }>
      getUsers(): Promise<ZKResponse<Record<string, unknown>> | Array<Record<string, unknown>>>
      getAttendances(): Promise<ZKResponse<Record<string, unknown>> | Array<Record<string, unknown>>>
      setUser(
        uid: number,
        userId: string,
        name: string,
        password: string,
        role: number,
        cardno: number
      ): Promise<unknown>
      deleteUser(uid: number): Promise<unknown>
    }
  }

  export default ZktecoJs
}

import { T_IO_PROPS } from '../ioSchema'
import component from '../component'
import type { IOPromiseConstructor, IOPromise } from '../io'

export default function selectMultiple(
  constructor: IOPromiseConstructor<'SELECT_MULTIPLE'>
) {
  return <
    Props extends T_IO_PROPS<'SELECT_MULTIPLE'>,
    Options extends Props['options']
  >(
    label: string,
    props: Props
  ) => {
    return constructor(component('SELECT_MULTIPLE', label, props)) as IOPromise<
      'SELECT_MULTIPLE',
      Options
    >
  }
}

import {useId} from 'react';
import styles from './capacity-input.module.css';
/** One capacity control; unit follows the selected service product. */
export default function CapacityInput({id,value,onChange,unit='Gbps',min,required=false,label='Kapasitas'}){
 const generated=useId(),inputId=id||generated;
 return <div className={styles.field}><label htmlFor={inputId}>{label}</label><div className={styles.control}><input data-capacity id={inputId} type="number" required={required} min={min??(unit==='pair'?1:0.000001)} step={unit==='pair'?1:'any'} value={value??''} onChange={onChange} aria-describedby={inputId+'-unit'}/><span id={inputId+'-unit'} className={styles.unit}>{unit}</span></div></div>;
}

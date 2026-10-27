<?php
declare(strict_types=1);
namespace App\Infrastructure\Reports;
use App\Application\Ports\ReportExporter;
use ZipArchive;
use DateTimeImmutable;
use DateTimeZone;
final class XlsxReportExporter implements ReportExporter
{
    private function xml(string $value): string { return htmlspecialchars(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $value), ENT_XML1 | ENT_QUOTES, 'UTF-8'); }
    private function date(?string $value): string { return $value ? (new DateTimeImmutable($value))->setTimezone(new DateTimeZone('America/Guayaquil'))->format('d/m/Y H:i:s') : ''; }
    public function export(array $report): string
    {
        $states=['disponible'=>'Disponible','prestado'=>'En préstamo','mantenimiento'=>'En mantenimiento','fuera_servicio'=>'Fuera de servicio','deshabilitado'=>'Deshabilitado'];
        $sheets=[
            'Equipos'=>[['Código','Equipo','Categoría','Ubicación','Estado actual','Veces prestado','Préstamos activos','Revisiones completadas']],
            'Préstamos'=>[['Código','Equipo','Reserva','Solicitante','Correo','Docente responsable','Motivo','Inicio reservado (Ecuador)','Fin reservado (Ecuador)','Inicio real (Ecuador)','Devolución real (Ecuador)','Estado']],
            'Revisiones'=>[['Código','Equipo','Revisado por','Fecha (Ecuador)','Comentarios']],
            'Información'=>[['Dato','Valor'],['Generado (Ecuador)',$this->date($report['generatedAt'])],['Conteo','Veces prestado cuenta préstamos iniciados, incluidos activos y pruebas del administrador; no reservas sin retiro.'],['Alcance','Equipos incluidos: '.count($report['equipment'])],['Fotos','Las evidencias se consultan dentro del sistema con sesión; no se incluyen imágenes en el Excel.']],
        ];
        foreach ($report['equipment'] as $e) $sheets['Equipos'][]=[$e['code'],$e['name'],$e['category'],$e['location'],$states[$e['status']] ?? $e['status'],$e['totalLoans'],$e['activeLoans'],$e['totalReviews']];
        foreach ($report['loans'] as $l) $sheets['Préstamos'][]=[$l['code'],$l['name'],'RES-'.str_pad((string)$l['reservationId'],5,'0',STR_PAD_LEFT),$l['requester'],$l['email'],$l['teacher'],$l['purpose'],$this->date($l['reservedStart']),$this->date($l['reservedEnd']),$this->date($l['startedAt']),$this->date($l['returnedAt']),$l['state']];
        foreach ($report['reviews'] as $m) $sheets['Revisiones'][]=[$m['code'],$m['name'],$m['reviewer'],$this->date($m['reviewedAt']),$m['comments']];
        $path=tempnam(sys_get_temp_dir(),'report-'); $zip=new ZipArchive();
        try {
            if ($zip->open($path,ZipArchive::OVERWRITE)!==true) throw new \RuntimeException('No se pudo crear Excel.');
            $types='<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>';
            $book='<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>';
            $rels='<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
            $index=0;
            foreach ($sheets as $name=>$rows) {
                $index++;
                $types=str_replace('</Types>','<Override PartName="/xl/worksheets/sheet'.$index.'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',$types);
                $book.='<sheet name="'.$this->xml($name).'" sheetId="'.$index.'" r:id="rId'.$index.'"/>';
                $rels.='<Relationship Id="rId'.$index.'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'.$index.'.xml"/>';
                $sheet='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="'.count($rows[0]).'" width="25" customWidth="1"/></cols><sheetData>';
                foreach ($rows as $n=>$row) {
                    $sheet.='<row r="'.($n+1).'">';
                    foreach ($row as $c=>$value) {
                        $ref=chr(65+$c).($n+1);
                        $sheet.=is_int($value) ? '<c r="'.$ref.'"><v>'.$value.'</v></c>' : '<c r="'.$ref.'" t="inlineStr"><is><t xml:space="preserve">'.$this->xml((string)$value).'</t></is></c>';
                    }
                    $sheet.='</row>';
                }
                $sheet.='</sheetData><autoFilter ref="A1:'.chr(64+count($rows[0])).count($rows).'"/></worksheet>';
                $zip->addFromString('xl/worksheets/sheet'.$index.'.xml',$sheet);
            }
            $zip->addFromString('[Content_Types].xml',$types);
            $zip->addFromString('xl/workbook.xml',$book.'</sheets></workbook>');
            $zip->addFromString('xl/_rels/workbook.xml.rels',$rels.'</Relationships>');
            $zip->addFromString('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
            $zip->close();
            return file_get_contents($path);
        } finally { if (file_exists($path)) unlink($path); }
    }
}

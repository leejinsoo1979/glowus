package com.glowus.hwp;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;

import kr.dogfoot.hwplib.object.HWPFile;
import kr.dogfoot.hwplib.object.bodytext.Section;
import kr.dogfoot.hwplib.object.bodytext.paragraph.Paragraph;
import kr.dogfoot.hwplib.object.bodytext.control.Control;
import kr.dogfoot.hwplib.object.bodytext.control.ControlTable;
import kr.dogfoot.hwplib.object.bodytext.control.table.Row;
import kr.dogfoot.hwplib.object.bodytext.control.table.Cell;
import kr.dogfoot.hwplib.reader.HWPReader;
import kr.dogfoot.hwplib.tool.objectfinder.FieldFinder;
import kr.dogfoot.hwplib.tool.textextractor.TextExtractor;
import kr.dogfoot.hwplib.writer.HWPWriter;

public class Main {
    public static void main(String[] args) {
        if (args.length < 1) {
            System.err.println("Usage:");
            System.err.println("  List fields: java -jar hwp-filler.jar list <template_path>");
            System.err.println("  Fill fields: java -jar hwp-filler.jar fill <template_path> <output_path> <data_json_path>");
            System.exit(1);
        }

        String command = args[0];

        if (command.equals("list")) {
            if (args.length < 2) {
                System.err.println("Usage: java -jar hwp-filler.jar list <template_path>");
                System.exit(1);
            }
            listFields(args[1]);
            return;
        }

        if (!command.equals("fill") && args.length == 3) {
            // Legacy mode: template, output, json
            fillTemplate(args[0], args[1], args[2]);
            return;
        }

        if (command.equals("fill")) {
            if (args.length < 4) {
                System.err.println("Usage: java -jar hwp-filler.jar fill <template_path> <output_path> <data_json_path>");
                System.exit(1);
            }
            fillTemplate(args[1], args[2], args[3]);
            return;
        }

        if (command.equals("fill-sections")) {
            if (args.length < 4) {
                System.err.println("Usage: java -jar hwp-filler.jar fill-sections <template_path> <output_path> <sections_json_path>");
                System.exit(1);
            }
            fillSections(args[1], args[2], args[3]);
            return;
        }

        System.err.println("Unknown command: " + command);
        System.exit(1);
    }

    private static void listFields(String templatePath) {
        try {
            System.out.println("=== HWP 템플릿 분석 ===");
            System.out.println("Template: " + templatePath);

            HWPFile hwp = HWPReader.fromFile(templatePath);
            if (hwp == null) {
                throw new RuntimeException("Failed to parse HWP file: " + templatePath);
            }

            System.out.println("HWP 파일 파싱 성공!");
            int sectionCount = hwp.getBodyText().getSectionList().size();
            System.out.println("섹션 수: " + sectionCount);

            // 테이블 구조 탐색
            int tableIndex = 0;
            for (int s = 0; s < sectionCount; s++) {
                Section section = hwp.getBodyText().getSectionList().get(s);
                System.out.println("\n=== 섹션 " + s + " ===");
                System.out.println("문단 수: " + section.getParagraphCount());

                for (int p = 0; p < section.getParagraphCount(); p++) {
                    Paragraph para = section.getParagraph(p);

                    // 문단 텍스트 추출
                    String paraText = "";
                    try {
                        if (para.getText() != null) {
                            paraText = para.getText().getNormalString(0);
                            if (paraText != null && !paraText.trim().isEmpty()) {
                                System.out.println("\n[문단 " + p + "] " + paraText.substring(0, Math.min(100, paraText.length())));
                            }
                        }
                    } catch (Exception e) {
                        // ignore encoding errors
                    }

                    // 컨트롤(테이블 등) 탐색
                    if (para.getControlList() != null) {
                        for (Control ctrl : para.getControlList()) {
                            if (ctrl instanceof ControlTable) {
                                ControlTable table = (ControlTable) ctrl;
                                System.out.println("\n  [테이블 " + tableIndex + "] " + table.getRowList().size() + "행");

                                int rowIdx = 0;
                                for (Row row : table.getRowList()) {
                                    int cellIdx = 0;
                                    StringBuilder rowText = new StringBuilder();
                                    for (Cell cell : row.getCellList()) {
                                        String cellText = getCellText(cell);
                                        if (cellText != null && !cellText.trim().isEmpty()) {
                                            rowText.append("[" + cellIdx + "]" + cellText.substring(0, Math.min(30, cellText.length())));
                                            if (cellText.length() > 30) rowText.append("...");
                                            rowText.append(" | ");
                                        }
                                        cellIdx++;
                                    }
                                    if (rowText.length() > 0) {
                                        System.out.println("    행" + rowIdx + ": " + rowText.toString());
                                    }
                                    rowIdx++;
                                    if (rowIdx > 5) {
                                        System.out.println("    ... (생략)");
                                        break;
                                    }
                                }
                                tableIndex++;
                            }
                        }
                    }
                }
            }

            System.out.println("\n총 테이블 수: " + tableIndex);

        } catch (Exception e) {
            e.printStackTrace();
            System.exit(1);
        }
    }

    private static String getCellText(Cell cell) {
        StringBuilder sb = new StringBuilder();
        try {
            if (cell.getParagraphList() != null) {
                for (Paragraph para : cell.getParagraphList()) {
                    if (para.getText() != null) {
                        String text = para.getText().getNormalString(0);
                        if (text != null) {
                            sb.append(text);
                        }
                    }
                }
            }
        } catch (Exception e) {
            // ignore encoding errors
        }
        return sb.toString();
    }

    private static void fillTemplate(String templatePath, String outputPath, String dataJsonPath) {
        try {
            System.out.println("DEBUG: Starting HWP Filler");
            System.out.println("DEBUG: Template Path: " + templatePath);

            // 1. Read HWP Template
            File hwpFile = new File(templatePath);
            if (!hwpFile.exists()) {
                throw new RuntimeException("Template file not found: " + templatePath);
            }
            System.out.println("DEBUG: Reading HWP file...");
            HWPFile hwp = HWPReader.fromFile(templatePath);
            if (hwp == null) {
                 throw new RuntimeException("Failed to parse HWP file: " + templatePath);
            }
            System.out.println("DEBUG: HWP file parsed successfully");

            // 2. Read JSON Data
            System.out.println("DEBUG: Reading JSON data...");
            String jsonContent = new String(Files.readAllBytes(Paths.get(dataJsonPath)));
            ObjectMapper mapper = new ObjectMapper();
            Map<String, Object> data = mapper.readValue(jsonContent, new TypeReference<Map<String, Object>>(){});

            // 3. Fill Fields (Text Replacement in Tables)
            System.out.println("Applying data to HWP tables...");
            int replacements = 0;

            // 긴 패턴부터 먼저 처리 (OOOOO before OOO)
            List<Map.Entry<String, Object>> sortedEntries = new ArrayList<>(data.entrySet());
            sortedEntries.sort((a, b) -> b.getKey().length() - a.getKey().length());

            for (Map.Entry<String, Object> entry : sortedEntries) {
                String searchText = entry.getKey();
                String replaceText = String.valueOf(entry.getValue());

                // 모든 섹션에서 텍스트 치환
                for (Section section : hwp.getBodyText().getSectionList()) {
                    for (int p = 0; p < section.getParagraphCount(); p++) {
                        Paragraph para = section.getParagraph(p);

                        // 1. 일반 문단 텍스트 치환
                        if (replaceTextInParagraph(para, searchText, replaceText)) {
                            replacements++;
                            System.out.println(" - Replaced (paragraph): " + searchText);
                        }

                        // 2. 테이블 내 텍스트 치환
                        if (para.getControlList() != null) {
                            for (Control ctrl : para.getControlList()) {
                                if (ctrl instanceof ControlTable) {
                                    ControlTable table = (ControlTable) ctrl;
                                    for (Row row : table.getRowList()) {
                                        for (Cell cell : row.getCellList()) {
                                            if (replaceTextInCell(cell, searchText, replaceText)) {
                                                replacements++;
                                                System.out.println(" - Replaced (table): " + searchText);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            System.out.println("Total replacements: " + replacements);

            // 4. Save Output
            HWPWriter.toFile(hwp, outputPath);
            System.out.println("Successfully generated HWP file: " + outputPath);

        } catch (Exception e) {
            e.printStackTrace();
            System.exit(1);
        }
    }

    /**
     * 섹션 기반 내용 삽입 (DIPS 템플릿용)
     * sections.json 형식: [{"header": "1-1.", "content": "..."}, ...]
     */
    private static void fillSections(String templatePath, String outputPath, String sectionsJsonPath) {
        try {
            System.out.println("DEBUG: Starting Section-based HWP Filler");

            HWPFile hwp = HWPReader.fromFile(templatePath);
            if (hwp == null) {
                throw new RuntimeException("Failed to parse HWP file");
            }
            System.out.println("DEBUG: HWP file parsed successfully");

            // JSON 읽기
            String jsonContent = new String(Files.readAllBytes(Paths.get(sectionsJsonPath)));
            ObjectMapper mapper = new ObjectMapper();
            List<Map<String, String>> sections = mapper.readValue(jsonContent,
                new TypeReference<List<Map<String, String>>>(){});

            int filled = 0;

            // 각 섹션에 대해 처리
            for (Map<String, String> section : sections) {
                String header = section.get("header");
                String content = section.get("content");

                if (header == null || content == null || content.isEmpty()) continue;

                System.out.println("Processing section: " + header);

                // 섹션 헤더 찾고 그 다음 ◦ 문단에 내용 삽입
                boolean foundHeader = false;
                boolean contentInserted = false;

                for (Section sec : hwp.getBodyText().getSectionList()) {
                    for (int p = 0; p < sec.getParagraphCount(); p++) {
                        Paragraph para = sec.getParagraph(p);
                        String paraText = getParaText(para);

                        // 섹션 헤더 찾기
                        if (!foundHeader && paraText != null && paraText.contains(header)) {
                            foundHeader = true;
                            System.out.println("  Found header at paragraph " + p);
                            continue;
                        }

                        // 헤더를 찾은 후, ◦ 문단 찾아서 내용 삽입
                        if (foundHeader && !contentInserted && paraText != null) {
                            String trimmed = paraText.trim();
                            // 빈 ◦ 문단이거나 " ◦ " 패턴
                            if (trimmed.equals("◦") || trimmed.equals("◦ ") || trimmed.startsWith("◦ ") && trimmed.length() < 5) {
                                // 내용 삽입
                                String newContent = " ◦ " + content.substring(0, Math.min(content.length(), 2000));
                                if (replaceParaText(para, newContent)) {
                                    System.out.println("  Inserted content at paragraph " + p + " (" + content.length() + " chars)");
                                    contentInserted = true;
                                    filled++;
                                }
                                break;
                            }
                        }
                    }
                    if (contentInserted) break;
                }

                if (!contentInserted) {
                    System.out.println("  WARNING: Could not insert content for " + header);
                }
            }

            // 저장
            HWPWriter.toFile(hwp, outputPath);
            System.out.println("Total sections filled: " + filled);
            System.out.println("Successfully generated: " + outputPath);

        } catch (Exception e) {
            e.printStackTrace();
            System.exit(1);
        }
    }

    private static String getParaText(Paragraph para) {
        try {
            if (para.getText() != null) {
                return para.getText().getNormalString(0);
            }
        } catch (Exception e) {}
        return null;
    }

    private static boolean replaceParaText(Paragraph para, String newText) {
        try {
            if (para.getText() != null && para.getText().getCharList() != null) {
                para.getText().getCharList().clear();
                for (char c : newText.toCharArray()) {
                    para.getText().getCharList().add(
                        new kr.dogfoot.hwplib.object.bodytext.paragraph.text.HWPCharNormal(c));
                }
                return true;
            }
        } catch (Exception e) {}
        return false;
    }

    private static boolean replaceTextInParagraph(Paragraph para, String search, String replace) {
        boolean replaced = false;
        try {
            if (para.getText() != null && para.getText().getCharList() != null) {
                String text = para.getText().getNormalString(0);
                if (text != null && text.contains(search)) {
                    // 문자 데이터 직접 수정
                    String newText = text.replace(search, replace);
                    para.getText().getCharList().clear();

                    // 새 텍스트로 교체
                    for (char c : newText.toCharArray()) {
                        para.getText().getCharList().add(new kr.dogfoot.hwplib.object.bodytext.paragraph.text.HWPCharNormal(c));
                    }
                    replaced = true;
                }
            }
        } catch (Exception e) {
            // ignore errors
        }
        return replaced;
    }

    private static boolean replaceTextInCell(Cell cell, String search, String replace) {
        boolean replaced = false;
        try {
            if (cell.getParagraphList() != null) {
                for (Paragraph para : cell.getParagraphList()) {
                    if (para.getText() != null && para.getText().getCharList() != null) {
                        String text = para.getText().getNormalString(0);
                        if (text != null && text.contains(search)) {
                            // 문자 데이터 직접 수정
                            String newText = text.replace(search, replace);
                            para.getText().getCharList().clear();

                            // 새 텍스트로 교체
                            for (char c : newText.toCharArray()) {
                                para.getText().getCharList().add(new kr.dogfoot.hwplib.object.bodytext.paragraph.text.HWPCharNormal(c));
                            }
                            replaced = true;
                        }
                    }
                }
            }
        } catch (Exception e) {
            // ignore errors
        }
        return replaced;
    }
}
